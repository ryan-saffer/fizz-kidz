import { randomUUID } from 'crypto'

import {
    canOrderCake,
    getPartyCreationCount,
    getActiveBirthdayPartyBookingPackages,
    getSquareLocationId,
    mapCakeSizeToSquareVariation,
    mapCandleToSquareVariation,
    mapProductToSquareVariation,
    mapServingMethodToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    NUMBER_OF_CHILDREN_MOBILE,
    NUMBER_OF_CHILDREN_STUDIO,
    orderedQuantities,
    partyFormV2RequiresPayment,
    type PreparePartyFormV2,
    type PartyFormV2Checkout,
} from '@fizz-kidz/core'

import { PartyFormMapper } from '../party-form-mapper'
import { buildPartyFormV2Submission } from './build-party-form-v2-submission'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { throwCustomTrpcError, throwTrpcError } from '@/app/trpc/transport-errors'
import { GiftCardInactiveError } from '@/app/trpc/trpc.errors'
import { checkGiftCardBalance } from '@/features/gift-cards/check-gift-card-balance'
import { checkDiscountCode } from '@/features/holiday-programs/core/discount-codes/check-discount-code'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { SanityClient } from '@/integrations/sanity/sanity.client'
import { getOrCreateCustomer } from '@/integrations/square/core/get-or-create-customer'
import { SquareClient } from '@/integrations/square/square.client'

/** Validates the answers and prepares an unpaid, server-priced order for the embedded payment form. */
export async function preparePartyFormV2({
    payload,
    discountCode,
    giftCardNumber,
}: PreparePartyFormV2): Promise<PartyFormV2Checkout> {
    const booking = await DatabaseClient.getPartyBooking(payload.bookingId)
    const submissionId = randomUUID()
    if (
        ![payload.parentFirstName, payload.parentLastName, payload.childName, payload.childAge].every((value) =>
            value.trim()
        )
    ) {
        throwTrpcError('BAD_REQUEST', 'Please complete the party details.')
    }
    const childCounts: readonly string[] =
        booking.type === 'studio' ? NUMBER_OF_CHILDREN_STUDIO : NUMBER_OF_CHILDREN_MOBILE
    if (!childCounts.includes(payload.numberOfChildren))
        throwTrpcError('BAD_REQUEST', 'Please select the number of children.')
    if (booking.type === 'studio' && !payload.foodPackage) throwTrpcError('BAD_REQUEST', 'Please choose a food option.')
    if (booking.type === 'mobile' && (payload.foodPackage || payload.additions.length))
        throwTrpcError('BAD_REQUEST', 'Food options are only available for studio parties.')
    if (payload.cake && !canOrderCake(booking.type, booking.location))
        throwTrpcError('BAD_REQUEST', 'Cakes are not available for this party.')
    const creationKeys = payload.creations.flatMap((group) => group.creationKeys)
    if (
        creationKeys.length !== getPartyCreationCount(booking) ||
        new Set(creationKeys).size !== creationKeys.length ||
        new Set(payload.creations.map((group) => group.packageKey)).size !== payload.creations.length
    ) {
        throwTrpcError('BAD_REQUEST', `Please select exactly ${getPartyCreationCount(booking)} different creations.`)
    }
    const sanity = await SanityClient.getInstance()
    const catalogue = await sanity.getBirthdayPartyBookingCatalogue()
    const available = getActiveBirthdayPartyBookingPackages(catalogue, booking.type)
    if (
        payload.creations.some((group) =>
            group.creationKeys.some(
                (key) =>
                    !available.find((item) => item.key === group.packageKey)?.creations.some((item) => item.key === key)
            )
        )
    ) {
        throwTrpcError('BAD_REQUEST', 'The form contains selections that are no longer available.')
    }
    try {
        new PartyFormMapper(buildPartyFormV2Submission(payload, booking, submissionId), catalogue).mapToBooking(
            booking.type,
            booking.location
        )
    } catch {
        throwTrpcError('BAD_REQUEST', 'The form contains selections that are no longer available.')
    }

    const locationId = getSquareLocationId(env === 'prod' ? booking.location : 'test')
    const summary: PartyFormV2Checkout = {
        submissionId,
        locationId,
        parentEmail: booking.parentEmail,
        subtotalCents: 0,
        discountCents: 0,
        discountCode: '',
        totalCents: 0,
        giftCardCents: 0,
        giftCardLast4: '',
        cardCents: 0,
        items: [],
    }
    let orderId: string | null = null
    let discount: Awaited<ReturnType<typeof checkDiscountCode>> | null = null
    let giftCardId = ''
    if (partyFormV2RequiresPayment(payload)) {
        const square = await SquareClient.getInstance()
        const customerId = await getOrCreateCustomer(
            payload.parentFirstName,
            payload.parentLastName,
            booking.parentEmail
        )
        const orderInput: Square.Order = {
            locationId,
            customerId,
            source: { name: 'Party Form' },
            pricingOptions: { autoApplyDiscounts: true },
            metadata: { programType: 'party-form-v2', bookingId: payload.bookingId, submissionId },
            lineItems: [
                ...(payload.cake
                    ? [
                          {
                              quantity: '1',
                              name: payload.cake.selection,
                              catalogObjectId: mapCakeSizeToSquareVariation(env, payload.cake.size),
                              modifiers: [
                                  {
                                      catalogObjectId: mapServingMethodToSquareVariation(env, payload.cake.served),
                                      quantity: '1',
                                  },
                                  {
                                      catalogObjectId: mapCandleToSquareVariation(env, payload.cake.candles),
                                      quantity: '1',
                                  },
                              ],
                          },
                      ]
                    : []),
                ...orderedQuantities(payload.takeHomeBags).map(([sku, quantity]) => ({
                    quantity: String(quantity),
                    catalogObjectId: mapTakeHomeBagToSquareVariation(env, sku),
                })),
                ...orderedQuantities(payload.products).map(([sku, quantity]) => ({
                    quantity: String(quantity),
                    catalogObjectId: mapProductToSquareVariation(env, sku),
                })),
            ],
        }
        const calculated = await square.orders.calculate({ order: orderInput })
        const subtotal = calculated.order?.totalMoney?.amount
        if (subtotal === undefined || subtotal === null || subtotal < 0n || !Number.isSafeInteger(Number(subtotal)))
            throwTrpcError('INTERNAL_SERVER_ERROR', 'Unable to calculate the order total.')
        summary.subtotalCents = Number(subtotal)
        summary.items = (calculated.order?.lineItems ?? []).flatMap((line) => {
            const modifiers = (line.modifiers ?? []).map((modifier) => ({
                label: modifier.name ?? 'Cake option',
                amountCents: Number(modifier.totalPriceMoney?.amount ?? 0),
            }))
            return [
                {
                    label: `${line.quantity} × ${line.name ?? 'Party item'}`,
                    amountCents:
                        Number(line.totalMoney?.amount ?? 0) -
                        modifiers.reduce((sum, item) => sum + item.amountCents, 0),
                },
                ...modifiers,
            ]
        })
        if (discountCode) {
            discount = await checkDiscountCode(discountCode, booking.parentEmail)
            if (typeof discount === 'string') throwTrpcError('BAD_REQUEST', `Discount code is ${discount}.`)
            const amount =
                discount.discountType === 'percentage'
                    ? Math.round((Number(subtotal) * discount.discountAmount) / 100)
                    : Math.round(discount.discountAmount * 100)
            if (!Number.isSafeInteger(amount) || amount < 0 || amount > Number(subtotal))
                throwTrpcError('BAD_REQUEST', 'This discount cannot be applied to the order total.')
            orderInput.discounts = [
                {
                    uid: 'discount-code',
                    name: `Discount code '${discount.code}'`,
                    scope: 'ORDER',
                    type: 'FIXED_AMOUNT',
                    amountMoney: { currency: 'AUD', amount: BigInt(amount) },
                },
            ]
            summary.discountCode = discount.code
        }
        const { order } = await square.orders.create({ idempotencyKey: submissionId, order: orderInput })
        if (
            !order?.id ||
            order.totalMoney?.amount == null ||
            order.totalMoney.currency !== 'AUD' ||
            order.totalMoney.amount < 0n ||
            !Number.isSafeInteger(Number(order.totalMoney.amount))
        )
            throwTrpcError('INTERNAL_SERVER_ERROR', 'Unable to prepare the order.')
        orderId = order.id
        summary.totalCents = Number(order.totalMoney.amount)
        summary.discountCents = summary.subtotalCents - summary.totalCents
        if (giftCardNumber && summary.totalCents > 0) {
            const gift = await checkGiftCardBalance(giftCardNumber)
            if (gift.state !== 'ACTIVE') throwCustomTrpcError(new GiftCardInactiveError())
            if (gift.balanceCents <= 0) throwTrpcError('BAD_REQUEST', 'This gift card has no remaining balance.')
            giftCardId = gift.giftCardId
            summary.giftCardLast4 = gift.last4
            summary.giftCardCents = Math.min(summary.totalCents, gift.balanceCents)
        }
        summary.cardCents = summary.totalCents - summary.giftCardCents
    }
    await DatabaseClient.createPartyFormV2Submission(submissionId, payload.bookingId, payload, {
        summary,
        orderId,
        giftCardId,
        discount:
            discount && typeof discount !== 'string'
                ? {
                      id: discount.id,
                      code: discount.code,
                      discountType: discount.discountType,
                      discountAmount: discount.discountAmount,
                  }
                : null,
        state: 'ready',
        leaseUntil: 0,
        receiptUrl: null,
        createdAt: Date.now(),
    })
    return summary
}
