import { readCheckoutMetadata, type CheckoutMetadata } from './checkout-order'
import { getReceiptUrl } from './take-checkout-payment'

import type { Square } from 'square'

import { throwCustomTrpcError, throwTrpcError } from '@/app/trpc/transport-errors'
import { PaymentMethodInvalidError } from '@/app/trpc/trpc.errors'
import { logError } from '@/integrations/observability/log-error'
import { getSquareError, SquareClient } from '@/integrations/square/square.client'

/**
 * `waiting`: the charge is on the terminal. `paid`: Square has the money. `canceled`: nothing was charged (cancelled
 * by staff or the customer, or the terminal timed out), so the checkout can be prepared and sent again.
 */
export type TerminalPaymentResult =
    | { status: 'waiting'; terminalCheckoutId: string }
    | { status: 'paid'; receiptUrl: string | null }
    | { status: 'canceled'; reason: string }

type CheckoutOrder = Square.Order & { id: string }

const CANCEL_REASONS: Record<string, string> = {
    BUYER_CANCELED: 'The customer cancelled the payment on the terminal.',
    SELLER_CANCELED: 'The charge was cancelled.',
    TIMED_OUT: 'The terminal timed out before the customer paid.',
}

/**
 * Sends a prepared checkout (see `prepareCheckout`) to a Square Terminal. The gift-card share is authorised first and
 * the terminal takes the rest; both are only captured once the terminal payment completes (`getTerminalPayment`), so
 * the customer is charged all at once or not at all. A gift card covering everything pays straight away.
 */
export async function startTerminalPayment(input: {
    checkoutId: string
    deviceId: string
    /** Shown on the payment in Square, e.g. whose party it was. */
    note: string
    /** Booking metadata the order must carry (as passed to `prepareCheckout`). */
    metadata: Record<string, string>
}): Promise<TerminalPaymentResult> {
    const square = await SquareClient.getInstance()
    const { order, checkout } = await getCheckoutOrder(input.checkoutId, input.metadata)
    if (order.state === 'COMPLETED') return { status: 'paid', receiptUrl: await getReceiptUrl(getPaymentIds(order)) }

    const giftCardPaymentId = await authoriseGiftCard(order, checkout)
    const terminalCents = Number(order.totalMoney?.amount ?? 0) - checkout.giftCardCents
    if (terminalCents <= 0) return payOrder(order, giftCardPaymentId ? [giftCardPaymentId] : [])

    const { checkout: terminalCheckout } = await square.terminal.checkouts
        .create({
            // one terminal charge per checkout; sending again prepares a new checkout
            idempotencyKey: `${order.id}-terminal`,
            checkout: {
                amountMoney: { currency: 'AUD', amount: BigInt(terminalCents) },
                orderId: order.id,
                referenceId: input.metadata.bookingId,
                customerId: order.customerId,
                note: input.note.slice(0, 500),
                // payments stay authorised until the order is paid with the gift card's share
                paymentOptions: { autocomplete: false },
                deviceOptions: {
                    deviceId: input.deviceId,
                    // the customer is emailed a receipt instead
                    skipReceiptScreen: true,
                    tipSettings: { allowTipping: false },
                },
            },
        })
        .catch(async (error) => {
            await releaseGiftCard(order, checkout)
            if (((await getSquareError(error))?.statusCode ?? 500) < 500)
                throwTrpcError('BAD_REQUEST', 'Unable to send the charge to the terminal. Please try again.', error)
            throw error
        })
    if (!terminalCheckout?.id) throw new Error('Square returned no terminal checkout')
    return { status: 'waiting', terminalCheckoutId: terminalCheckout.id }
}

/**
 * Where a terminal charge is up to, and safe to call repeatedly. Once the terminal payment completes, the order is paid
 * with it and the gift-card share. A cancelled charge releases the gift-card share.
 */
export async function getTerminalPayment(input: {
    checkoutId: string
    terminalCheckoutId: string
    metadata: Record<string, string>
}): Promise<TerminalPaymentResult> {
    const square = await SquareClient.getInstance()
    const { order, checkout } = await getCheckoutOrder(input.checkoutId, input.metadata)
    const { checkout: terminalCheckout } = await square.terminal.checkouts.get({ checkoutId: input.terminalCheckoutId })
    if (terminalCheckout?.orderId !== order.id) throwTrpcError('BAD_REQUEST', 'This charge is for a different order.')

    if (order.state === 'COMPLETED') return { status: 'paid', receiptUrl: await getReceiptUrl(getPaymentIds(order)) }

    switch (terminalCheckout.status) {
        case 'COMPLETED': {
            const giftCardPaymentId = await authoriseGiftCard(order, checkout)
            return payOrder(order, [
                ...(giftCardPaymentId ? [giftCardPaymentId] : []),
                ...(terminalCheckout.paymentIds ?? []),
            ])
        }
        case 'CANCELED':
            // An uncaptured terminal payment that completes after this is never captured, and Square cancels it
            await releaseGiftCard(order, checkout)
            return {
                status: 'canceled',
                reason: CANCEL_REASONS[terminalCheckout.cancelReason ?? ''] ?? 'The charge was cancelled.',
            }
        default:
            return { status: 'waiting', terminalCheckoutId: input.terminalCheckoutId }
    }
}

/** Asks the terminal to cancel. A customer who has already paid still completes; `getTerminalPayment` shows which. */
export async function cancelTerminalPayment(terminalCheckoutId: string) {
    const square = await SquareClient.getInstance()
    await square.terminal.checkouts.cancel({ checkoutId: terminalCheckoutId }).catch(async (error) => {
        // a checkout that already finished can't be cancelled; its status says how it ended
        if (((await getSquareError(error))?.statusCode ?? 500) >= 500) throw error
    })
}

async function getCheckoutOrder(checkoutId: string, metadata: Record<string, string>) {
    const square = await SquareClient.getInstance()
    const { order } = await square.orders.get({ orderId: checkoutId })
    const checkout = order ? readCheckoutMetadata(order) : null
    if (!order?.id || !checkout || Object.entries(metadata).some(([key, value]) => order.metadata?.[key] !== value))
        throwTrpcError('BAD_REQUEST', 'This checkout is for a different booking. Please start again.')
    if (order.state !== 'OPEN' && order.state !== 'COMPLETED')
        throwTrpcError('BAD_REQUEST', 'This checkout is no longer available. Please start again.')
    return { order: { ...order, id: order.id } as CheckoutOrder, checkout }
}

/**
 * Authorises the gift-card share, or returns the id of the one already authorised: the idempotency key is derived from
 * the order, so repeating the call returns the original payment.
 */
async function authoriseGiftCard(order: CheckoutOrder, checkout: CheckoutMetadata) {
    if (checkout.giftCardCents <= 0) return null
    const square = await SquareClient.getInstance()
    const { payment } = await square.payments
        .create({
            idempotencyKey: `${order.id}-gift`,
            sourceId: checkout.giftCardId,
            autocomplete: false,
            orderId: order.id,
            locationId: order.locationId,
            amountMoney: { currency: 'AUD', amount: BigInt(checkout.giftCardCents) },
        })
        .catch(async (error) => {
            if (((await getSquareError(error))?.statusCode ?? 500) >= 500) throw error
            return throwCustomTrpcError(
                new PaymentMethodInvalidError('The gift card could not be charged. Please check it and try again.')
            )
        })
    if (!payment?.id) throw new Error('Missing gift-card authorisation')
    return payment.id
}

async function releaseGiftCard(order: CheckoutOrder, checkout: CheckoutMetadata) {
    if (checkout.giftCardCents <= 0) return
    const square = await SquareClient.getInstance()
    try {
        const paymentId = await authoriseGiftCard(order, checkout)
        if (!paymentId) return
        const { payment } = await square.payments.get({ paymentId })
        if (payment?.status === 'APPROVED') await square.payments.cancel({ paymentId })
    } catch (error) {
        // Square cancels an uncaptured authorisation on its own if this fails
        logError('Unable to release a terminal checkout gift-card authorisation', error, { orderId: order.id })
    }
}

async function payOrder(order: CheckoutOrder, paymentIds: string[]): Promise<TerminalPaymentResult> {
    const square = await SquareClient.getInstance()
    await square.orders.pay({ orderId: order.id, paymentIds, idempotencyKey: `${order.id}-pay` })
    return { status: 'paid', receiptUrl: await waitForReceiptUrl(paymentIds) }
}

/** Square captures the payments a moment after the order is paid, and only then has a receipt. */
async function waitForReceiptUrl(paymentIds: string[]) {
    // an order discounted to nothing is paid without any payment, so has no receipt
    for (let attempt = 0; paymentIds.length > 0 && attempt < 5; attempt++) {
        const receiptUrl = await getReceiptUrl(paymentIds)
        if (receiptUrl) return receiptUrl
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    return null
}

function getPaymentIds(order: Square.Order) {
    return (order.tenders ?? []).flatMap((tender) => tender.paymentId ?? [])
}
