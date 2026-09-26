import type { CheckoutMetadata } from './checkout-order'
import type { Square } from 'square'

import { throwCustomTrpcError } from '@/app/trpc/transport-errors'
import { PaymentMethodInvalidError } from '@/app/trpc/trpc.errors'
import { logError } from '@/integrations/observability/log-error'
import { getSquareError, SquareClient } from '@/integrations/square/square.client'

/**
 * Pays an open checkout order: authorise the gift-card share, authorise the card or wallet for the rest, then pay the
 * order with both, so the customer is charged all at once or not at all. Every Square call uses a key derived from the
 * order id, so replaying after an unclear failure returns the original payments rather than charging again. A 4xx from
 * Square means nothing was charged: the authorisations so far are released and the customer prepares a new checkout.
 * Returns the receipt URL.
 */
export async function takeCheckoutPayment(
    order: Square.Order & { id: string },
    checkout: CheckoutMetadata,
    { token, buyerVerificationToken }: { token: string; buyerVerificationToken: string }
) {
    const square = await SquareClient.getInstance()
    const locationId = order.locationId
    const totalCents = Number(order.totalMoney?.amount ?? 0)
    const cardCents = totalCents - checkout.giftCardCents
    const paymentIds: string[] = []

    const failIfDefinite = (message: string) => async (error: unknown) => {
        const status = (await getSquareError(error))?.statusCode ?? 0
        if (status < 400 || status >= 500) throw error
        await Promise.all(
            paymentIds.map((paymentId) =>
                square.payments
                    .cancel({ paymentId })
                    .catch((cancelError) =>
                        logError('Unable to release a checkout authorisation', cancelError, { paymentId })
                    )
            )
        )
        return throwCustomTrpcError(new PaymentMethodInvalidError(message))
    }

    if (checkout.giftCardCents > 0) {
        const { payment } = await square.payments
            .create({
                idempotencyKey: `${order.id}-gift`,
                sourceId: checkout.giftCardId,
                autocomplete: false,
                orderId: order.id,
                locationId,
                amountMoney: { currency: 'AUD', amount: BigInt(checkout.giftCardCents) },
            })
            .catch(failIfDefinite('Gift-card payment failed. Please refresh the payment summary.'))
        if (!payment?.id) throw new Error('Missing gift-card authorisation')
        paymentIds.push(payment.id)
    }

    if (cardCents > 0) {
        const { payment } = await square.payments
            .create({
                idempotencyKey: `${order.id}-card`,
                sourceId: token,
                verificationToken: buyerVerificationToken || undefined,
                autocomplete: false,
                orderId: order.id,
                locationId,
                amountMoney: { currency: 'AUD', amount: BigInt(cardCents) },
                buyerEmailAddress: checkout.customerEmail,
                customerDetails: { customerInitiated: true, sellerKeyedIn: false },
            })
            .catch(failIfDefinite('Payment failed. Please check your card details.'))
        if (!payment?.id) throw new Error('Missing card authorisation')
        paymentIds.push(payment.id)
    }

    await square.orders
        .pay({ orderId: order.id, paymentIds, idempotencyKey: `${order.id}-pay` })
        .catch(failIfDefinite('Payment failed. Please refresh the payment summary.'))
    return getReceiptUrl(paymentIds)
}

/** The receipt of the last payment on the order (the card, when there is one). Receipts appear after capture. */
export async function getReceiptUrl(paymentIds: string[]) {
    const square = await SquareClient.getInstance()
    for (const paymentId of [...paymentIds].reverse()) {
        const captured = await square.payments.get({ paymentId }).catch(() => null)
        if (captured?.payment?.receiptUrl) return captured.payment.receiptUrl
    }
    return null
}
