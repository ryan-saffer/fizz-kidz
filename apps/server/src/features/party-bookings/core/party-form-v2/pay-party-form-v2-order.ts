import type { SubmitPartyFormV2 } from '@fizz-kidz/core'

import type { PartyFormV2PaymentRecord } from '@/integrations/firebase/firestore.refs'

import { throwCustomTrpcError, throwTrpcError } from '@/app/trpc/transport-errors'
import { PaymentMethodInvalidError } from '@/app/trpc/trpc.errors'
import { getSquareError, SquareClient } from '@/integrations/square/square.client'

/** Uses the preschool-v2 split-tender flow: authorise gift/card payments, then pay the order. */
export async function payPartyFormV2Order(input: SubmitPartyFormV2, payment: PartyFormV2PaymentRecord) {
    if (!payment.orderId) return null
    const square = await SquareClient.getInstance()
    const { summary, orderId } = payment
    const { order } = await square.orders.get({ orderId })
    if (order?.state === 'COMPLETED') return payment.receiptUrl
    if (
        order?.state !== 'OPEN' ||
        order.totalMoney?.amount !== BigInt(summary.totalCents) ||
        order.locationId !== summary.locationId
    ) {
        throwTrpcError('BAD_REQUEST', 'The payment order is no longer available.')
    }
    const paymentIds: string[] = []
    let receiptUrl: string | null = null
    if (summary.giftCardCents > 0) {
        const { payment: gift } = await square.payments
            .create({
                idempotencyKey: `${input.submissionId}-gift`,
                sourceId: payment.giftCardId,
                autocomplete: false,
                orderId,
                locationId: summary.locationId,
                amountMoney: { currency: 'AUD', amount: BigInt(summary.giftCardCents) },
            })
            .catch(async (error) => {
                const squareError = await getSquareError(error)
                if (squareError?.errors?.some((item) => item.category === 'PAYMENT_METHOD_ERROR')) {
                    throwCustomTrpcError(
                        new PaymentMethodInvalidError('Gift-card payment failed. Please refresh the payment summary.')
                    )
                }
                throw error
            })
        if (!gift?.id) throw new Error('Missing gift-card authorisation')
        const currentGift = (await square.payments.get({ paymentId: gift.id })).payment
        if (currentGift?.status === 'CANCELED' || currentGift?.status === 'FAILED') {
            throwCustomTrpcError(
                new PaymentMethodInvalidError(
                    'Gift-card authorisation was cancelled. Please refresh the payment summary.'
                )
            )
        }
        if (currentGift?.status !== 'APPROVED') throw new Error('Gift-card authorisation is not approved')
        paymentIds.push(gift.id)
        receiptUrl = gift.receiptUrl ?? null
    }
    if (summary.cardCents > 0) {
        try {
            const { payment: card } = await square.payments.create({
                idempotencyKey: `${input.submissionId}-card`,
                sourceId: input.token,
                verificationToken: input.buyerVerificationToken || undefined,
                autocomplete: false,
                orderId,
                locationId: summary.locationId,
                amountMoney: { currency: 'AUD', amount: BigInt(summary.cardCents) },
                buyerEmailAddress: summary.parentEmail,
                customerDetails: { customerInitiated: true, sellerKeyedIn: false },
            })
            if (!card?.id) throw new Error('Missing card authorisation')
            const currentCard = (await square.payments.get({ paymentId: card.id })).payment
            if (currentCard?.status === 'CANCELED' || currentCard?.status === 'FAILED') {
                throwCustomTrpcError(
                    new PaymentMethodInvalidError(
                        'Card authorisation was cancelled. Please refresh the payment summary.'
                    )
                )
            }
            if (currentCard?.status !== 'APPROVED') throw new Error('Card authorisation is not approved')
            paymentIds.push(card.id)
            receiptUrl = card.receiptUrl ?? null
        } catch (error) {
            const squareError = await getSquareError(error)
            if (
                (error as { cause?: unknown }).cause instanceof PaymentMethodInvalidError ||
                squareError?.errors?.some((item) => item.category === 'PAYMENT_METHOD_ERROR')
            ) {
                await Promise.all(paymentIds.map((paymentId) => square.payments.cancel({ paymentId })))
                throwCustomTrpcError(new PaymentMethodInvalidError('Payment failed. Please check your card details.'))
            }
            throw error
        }
    }
    await square.orders.pay({ orderId, paymentIds, idempotencyKey: `${input.submissionId}-pay` })
    // Receipt URLs may only be populated after capture.
    for (const paymentId of [...paymentIds].reverse()) {
        const captured = await square.payments.get({ paymentId }).catch(() => null)
        if (captured?.payment?.receiptUrl) return captured.payment.receiptUrl
    }
    return receiptUrl
}
