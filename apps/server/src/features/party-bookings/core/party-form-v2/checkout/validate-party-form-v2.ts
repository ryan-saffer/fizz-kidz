import {
    canOrderCake,
    getPartyCreationCount,
    getTakeHomeMinimum,
    mapProductToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    MIN_TAKE_HOME_QUANTITY,
    NUMBER_OF_CHILDREN_MOBILE,
    NUMBER_OF_CHILDREN_STUDIO,
    orderedQuantities,
    type Booking,
    type PartyFormV2,
    type PartyFormV2PartyAnswers,
    type ProductType,
} from '@fizz-kidz/core'

import { PartyFormMapper } from '../../party-form-mapper'
import { buildPartyFormV2Submission } from '../build-party-form-v2-submission'
import { getPartyFormV2CakeOptions } from '../options/get-party-form-v2-cake-options'
import { getPartyFormV2TakeHomeOptions } from '../options/get-party-form-v2-take-home-options'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { SanityClient } from '@/integrations/sanity/sanity.client'

const NO_LONGER_AVAILABLE = 'The form contains selections that are no longer available.'

/**
 * Checks the answers against the booking, and builds what's paid now: the cake and take-home goodies as Square line
 * items (food is paid at the end of the party). Choices Square or Sanity no longer offer fail here or when Square
 * prices the order. The cake form (`mode: 'cake'`) skips the party questions.
 */
export async function validatePartyFormV2(payload: PartyFormV2) {
    const booking = await DatabaseClient.getPartyBooking(payload.bookingId)
    if (payload.mode === 'party') validatePartyAnswers(payload, booking)

    if (payload.cake && !canOrderCake(booking.type, booking.location))
        throwTrpcError('BAD_REQUEST', 'Cakes are not available for this party.')
    if (payload.cake && booking.cake) throwTrpcError('BAD_REQUEST', 'A cake has already been ordered for this party.')
    const takeHomeBags = orderedQuantities(payload.takeHomeBags)
    const products = orderedQuantities(payload.products)
    if (
        takeHomeBags.some(([key, quantity]) => quantity < getTakeHomeMinimum(booking.takeHomeBags?.[key])) ||
        products.some(([key, quantity]) => quantity < getTakeHomeMinimum(booking.products?.[key]))
    )
        throwTrpcError('BAD_REQUEST', `Take-home items have a minimum of ${MIN_TAKE_HOME_QUANTITY}.`)

    // the Paperform pipeline must accept the answers (e.g. creations Sanity no longer offers for this party)
    const catalogue = await (await SanityClient.getInstance()).getBirthdayPartyBookingCatalogue()
    try {
        new PartyFormMapper(buildPartyFormV2Submission(payload, booking, 'validation'), catalogue).mapToBooking(
            booking.type,
            booking.location
        )
    } catch {
        throwTrpcError('BAD_REQUEST', NO_LONGER_AVAILABLE)
    }

    const discounts = await getKitTopUpDiscounts(products, booking)
    const lineItems: Square.OrderLineItem[] = [
        ...(payload.cake ? [await buildCakeLine(payload.cake, booking)] : []),
        ...takeHomeBags.map(([key, quantity]) => ({
            quantity: String(quantity),
            catalogObjectId: mapTakeHomeBagToSquareVariation(env, key),
        })),
        ...products.map(([key, quantity]) => ({
            quantity: String(quantity),
            catalogObjectId: mapProductToSquareVariation(env, key),
            appliedDiscounts: discounts.some((discount) => discount.uid === key) ? [{ discountUid: key }] : undefined,
        })),
    ]
    if (payload.mode === 'cake' && lineItems.length === 0)
        throwTrpcError('BAD_REQUEST', 'Please choose a cake or take-home goodies to order.')
    return { booking, lineItems, discounts }
}

/** The party details questions, which only the full party form asks. */
function validatePartyAnswers(payload: PartyFormV2PartyAnswers, booking: Booking) {
    const childCounts: readonly string[] =
        booking.type === 'studio' ? NUMBER_OF_CHILDREN_STUDIO : NUMBER_OF_CHILDREN_MOBILE
    if (!childCounts.includes(payload.numberOfChildren))
        throwTrpcError('BAD_REQUEST', 'Please select the number of children.')
    if (booking.type === 'studio' && !payload.foodPackage) throwTrpcError('BAD_REQUEST', 'Please choose a food option.')
    if (booking.type === 'mobile' && (payload.foodPackage || payload.additions.length))
        throwTrpcError('BAD_REQUEST', 'Food options are only available for studio parties.')
    const creationKeys = payload.creations.flatMap((group) => group.creationKeys)
    if (
        creationKeys.length !== getPartyCreationCount(booking) ||
        new Set(creationKeys).size !== creationKeys.length ||
        new Set(payload.creations.map((group) => group.packageKey)).size !== payload.creations.length
    ) {
        throwTrpcError('BAD_REQUEST', `Please select exactly ${getPartyCreationCount(booking)} different creations.`)
    }
}

/** The cake as one line: its size variation plus serving, candle, design and flavour modifiers from Square. */
async function buildCakeLine(cake: NonNullable<PartyFormV2['cake']>, booking: Booking): Promise<Square.OrderLineItem> {
    const { selection, size, flavours, served, candles } = cake
    const options = await getPartyFormV2CakeOptions(booking.location)
    const find = (list: { id: string; name: string }[], name: string) => list.find((option) => option.name === name)
    const chosen = {
        size: find(options.sizes, size),
        design: find(options.designs, selection),
        served: find(options.servingOptions, served),
        candles: find(options.candleOptions, candles),
        flavours: flavours.map((name) => find(options.flavours, name)),
    }
    if (
        !chosen.size ||
        !chosen.design ||
        !chosen.served ||
        !chosen.candles ||
        chosen.flavours.some((item) => !item) ||
        new Set(flavours).size !== flavours.length
    )
        throwTrpcError('BAD_REQUEST', NO_LONGER_AVAILABLE)
    if (flavours.length < options.minFlavours || flavours.length > options.maxFlavours)
        throwTrpcError(
            'BAD_REQUEST',
            `Please choose between ${options.minFlavours} and ${options.maxFlavours} cake flavours.`
        )
    return {
        quantity: '1',
        name: `${selection} - ${size}`,
        catalogObjectId: chosen.size.id,
        modifiers: [chosen.served, chosen.candles, chosen.design, ...chosen.flavours].flatMap((item) =>
            item ? [{ catalogObjectId: item.id, quantity: '1' }] : []
        ),
    }
}

/**
 * Square's kit bulk price needs 12 kits in one order, so a top-up of fewer kits for a party that already has 12 is
 * discounted down to the bulk price the form showed.
 */
async function getKitTopUpDiscounts(
    ordered: [ProductType, number][],
    booking: Booking
): Promise<Square.OrderLineItemDiscount[]> {
    const total = (quantities: [ProductType, number][]) => quantities.reduce((sum, [, quantity]) => sum + quantity, 0)
    const orderedTotal = total(ordered)
    if (
        total(orderedQuantities(booking.products)) < MIN_TAKE_HOME_QUANTITY ||
        orderedTotal === 0 ||
        orderedTotal >= MIN_TAKE_HOME_QUANTITY
    )
        return []
    const { products: offered } = await getPartyFormV2TakeHomeOptions(booking.location)
    return ordered.flatMap(([key, quantity]) => {
        const option = offered.find((item) => item.key === key)
        const cents = option ? (option.regularPriceCents - option.priceCents) * quantity : 0
        if (cents <= 0) return []
        return {
            uid: key,
            name: 'Take-home kit bulk price',
            scope: 'LINE_ITEM',
            type: 'FIXED_AMOUNT',
            amountMoney: { currency: 'AUD', amount: BigInt(cents) },
        }
    })
}
