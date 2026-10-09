import { FieldValue } from 'firebase-admin/firestore'

import { normalize } from '@fizz-kidz/core'

import { DISCOUNT_CODE_UID, getDiscountCodeCents, readCheckoutMetadata, type CheckoutMetadata } from './checkout-order'
import { getReceiptUrl, takeCheckoutPayment } from './take-checkout-payment'

import type { Square } from 'square'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { PaymentMethodInvalidError } from '@/app/trpc/trpc.errors'
import { checkDiscountCode, getDiscountCodeRedemptionKey } from '@/features/discount-codes/core/check-discount-code'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { logError } from '@/integrations/observability/log-error'
import { SquareClient } from '@/integrations/square/square.client'

export type PayCheckoutInput = {
    /** The `checkoutId` returned by `prepareCheckout`. */
    checkoutId: string
    /** The Square card or wallet token; empty when a gift card or discount covers everything. */
    token: string
    buyerVerificationToken: string
    /** Booking metadata the order must carry (as passed to `prepareCheckout`), so it can't pay for something else. */
    metadata?: Record<string, string>
}

/**
 * `paid`: Square has the money, and the booking flow can carry on (safe to repeat).
 * `processing`: Square's response was lost or unclear; call again with the same input to find out.
 */
export type PayCheckoutResult = { status: 'paid'; receiptUrl: string | null } | { status: 'processing' }

/**
 * Pays a prepared checkout, and is safe to call again with the same input: a paid order returns `paid` without
 * charging again. Definite failures (declined card, expired discount code, changed order) throw, and the customer
 * prepares a new checkout. The discount code's use is recorded once the order is paid.
 */
export async function payCheckout(input: PayCheckoutInput): Promise<PayCheckoutResult> {
    const square = await SquareClient.getInstance()
    const { order } = await square.orders.get({ orderId: input.checkoutId })
    const checkout = order ? readCheckoutMetadata(order) : null
    if (
        !order?.id ||
        !checkout ||
        Object.entries(input.metadata ?? {}).some(([key, value]) => order.metadata?.[key] !== value)
    )
        throwTrpcError('BAD_REQUEST', 'Please refresh the payment summary.')
    const paidOrder = { ...order, id: order.id }

    if (order.state === 'COMPLETED') {
        await recordDiscountRedemption(paidOrder, checkout)
        return {
            status: 'paid',
            receiptUrl: await getReceiptUrl((order.tenders ?? []).flatMap((tender) => tender.paymentId ?? [])),
        }
    }
    if (order.state !== 'OPEN')
        throwTrpcError('BAD_REQUEST', 'The payment order is no longer available. Please refresh the payment summary.')

    await revalidateDiscountCode(order, checkout)
    const totalCents = Number(order.totalMoney?.amount ?? 0)
    if (totalCents > checkout.giftCardCents && !input.token)
        throwTrpcError('BAD_REQUEST', 'Please enter your card details.')

    let receiptUrl: string | null
    try {
        receiptUrl = await takeCheckoutPayment(paidOrder, checkout, input)
    } catch (error) {
        if ((error as { cause?: unknown }).cause instanceof PaymentMethodInvalidError) throw error
        // Square may have taken the payment even though we didn't hear back. Replaying the same input is safe.
        logError('Checkout payment awaiting reconciliation', error, { checkoutId: input.checkoutId })
        return { status: 'processing' }
    }
    await recordDiscountRedemption(paidOrder, checkout)
    return { status: 'paid', receiptUrl }
}

/** A code can expire, run out or change between preparing and paying; the order keeps its original amount. */
async function revalidateDiscountCode(order: Square.Order, checkout: CheckoutMetadata) {
    if (!checkout.discountCodeId) return
    const discount = await checkDiscountCode(checkout.discountCode, checkout.customerEmail)
    const appliedCents = Number(order.discounts?.find((it) => it.uid === DISCOUNT_CODE_UID)?.appliedMoney?.amount ?? 0)
    const baseCents = Number(order.totalMoney?.amount ?? 0) + appliedCents
    if (
        typeof discount === 'string' ||
        discount.id !== checkout.discountCodeId ||
        getDiscountCodeCents(discount, baseCents) !== appliedCents
    )
        throwTrpcError(
            'BAD_REQUEST',
            'The discount code has changed or is no longer available. Please refresh the payment summary.'
        )
}

/** Counts the discount code's use once per order, however many times the payment is replayed. */
async function recordDiscountRedemption(order: Square.Order & { id: string }, checkout: CheckoutMetadata) {
    if (!checkout.discountCodeId || (await DatabaseClient.hasDiscountCodeRedemption(order.id))) return
    const [discount] = await DatabaseClient.checkDiscountCode(checkout.discountCode)
    if (!discount) {
        logError('Paid checkout used a discount code that no longer exists', undefined, { checkoutId: order.id })
        return
    }
    await DatabaseClient.createDiscountCodeRedemption(
        {
            code: checkout.discountCode,
            normalizedCode: normalize(checkout.discountCode),
            customerEmail: checkout.customerEmail,
            normalizedCustomerEmail: normalize(checkout.customerEmail),
            redemptionKey: getDiscountCodeRedemptionKey(checkout.discountCode, checkout.customerEmail),
            customerName: checkout.customerName,
            bookingType: checkout.program,
            amountCents: Number(order.totalMoney?.amount ?? 0),
            discountType: discount.discountType,
            discountAmount: discount.discountAmount,
            appointmentIds: [],
            idempotencyKey: order.id,
            usedAt: new Date(),
        },
        order.id
    )
    await DatabaseClient.updateDiscountCode(checkout.discountCode, { numberOfUses: FieldValue.increment(1) })
}
