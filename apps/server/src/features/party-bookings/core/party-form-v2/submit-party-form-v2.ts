import { normalize, type SubmitPartyFormV2 } from '@fizz-kidz/core'

import { payPartyFormV2Order } from './pay-party-form-v2-order'
import { processPartyFormV2Submission } from './process-party-form-v2'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { PaymentMethodInvalidError } from '@/app/trpc/trpc.errors'
import { getDiscountCodeRedemptionKey } from '@/features/holiday-programs/core/discount-codes/check-discount-code'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { logError } from '@/integrations/observability/log-error'
import { SquareClient } from '@/integrations/square/square.client'

export type SubmitPartyFormV2Result = { status: 'completed'; receiptUrl: string | null } | { status: 'processing' }

/** Charges the prepared order, then applies its stored answers. Replays never create another order. */
export async function submitPartyFormV2(input: SubmitPartyFormV2): Promise<SubmitPartyFormV2Result> {
    const { payload, payment } = await DatabaseClient.getPartyFormV2Submission(input.submissionId)
    if (!payment) throwTrpcError('BAD_REQUEST', 'Please refresh the payment summary.')
    if (payment.state === 'completed') return { status: 'completed', receiptUrl: payment.receiptUrl }
    if (payment.state === 'failed') throwTrpcError('BAD_REQUEST', 'Please refresh the payment summary and try again.')

    if (payment.state !== 'paid') {
        const square = payment.orderId ? await SquareClient.getInstance() : null
        const order = payment.orderId ? (await square!.orders.get({ orderId: payment.orderId })).order : null
        if (order?.state === 'COMPLETED') {
            Object.assign(
                payment,
                await DatabaseClient.updatePartyFormV2Payment(input.submissionId, (current) => ({
                    state: current.state === 'completed' ? 'completed' : 'paid',
                }))
            )
        } else {
            if (
                !(await DatabaseClient.claimPartyFormV2Payment(input.submissionId, (current) => {
                    if (!current || ['completed', 'paid', 'failed'].includes(current.state)) return null
                    if (current.state === 'paying' && current.leaseUntil > Date.now()) return null
                    return { ...current, state: 'paying', leaseUntil: Date.now() + 120_000 }
                }))
            )
                return { status: 'processing' }
            let charging = false
            try {
                if (
                    payment.orderId &&
                    (order?.state !== 'OPEN' ||
                        order.totalMoney?.amount !== BigInt(payment.summary.totalCents) ||
                        order.locationId !== payment.summary.locationId)
                ) {
                    throwTrpcError(
                        'BAD_REQUEST',
                        'The payment order is no longer available. Please refresh the payment summary.'
                    )
                }
                // Only validate again before the first charge. An interrupted attempt must replay
                // its original tenders, even if those authorisations changed the gift-card balance.
                if (!payment.validated) {
                    if (payment.discount) {
                        const expected = payment.discount
                        await DatabaseClient.reservePartyFormV2Discount(
                            input.submissionId,
                            expected.id,
                            getDiscountCodeRedemptionKey(expected.code, payment.summary.parentEmail),
                            (discount, alreadyRedeemed) => {
                                if (
                                    !discount ||
                                    discount.expiryDate < new Date() ||
                                    discount.numberOfUses >= discount.numberOfUsesAllocated ||
                                    (discount.limitToOneUsePerCustomer && alreadyRedeemed) ||
                                    discount.discountType !== expected.discountType ||
                                    discount.discountAmount !== expected.discountAmount
                                ) {
                                    throwTrpcError(
                                        'BAD_REQUEST',
                                        'The discount code has changed or is no longer available. Please refresh the payment summary.'
                                    )
                                }
                            }
                        )
                        payment.discountReserved = true
                    }
                    if (payment.summary.giftCardCents > 0) {
                        const { giftCard } = await square!.giftCards.get({ id: payment.giftCardId })
                        if (
                            giftCard?.state !== 'ACTIVE' ||
                            giftCard.balanceMoney?.currency !== 'AUD' ||
                            Number(giftCard.balanceMoney?.amount ?? 0) < payment.summary.giftCardCents
                        ) {
                            throwTrpcError(
                                'BAD_REQUEST',
                                'The gift-card balance has changed. Please refresh the payment summary.'
                            )
                        }
                    }
                    if (payment.summary.cardCents > 0 && !input.token)
                        throwTrpcError('BAD_REQUEST', 'Please enter your card details.')
                    payment.validated = true
                    payment.state = 'paying'
                    payment.leaseUntil = Date.now() + 120_000
                    Object.assign(
                        payment,
                        await DatabaseClient.updatePartyFormV2Payment(input.submissionId, () => ({
                            validated: true,
                            state: 'paying',
                            leaseUntil: payment.leaseUntil,
                        }))
                    )
                }
                charging = true
                payment.receiptUrl = await payPartyFormV2Order(input, payment)
                Object.assign(
                    payment,
                    await DatabaseClient.updatePartyFormV2Payment(input.submissionId, (current) => ({
                        state: current.state === 'completed' ? 'completed' : 'paid',
                        receiptUrl: payment.receiptUrl ?? current.receiptUrl,
                    }))
                )
            } catch (error) {
                if (!charging || (error as { cause?: unknown }).cause instanceof PaymentMethodInvalidError) {
                    if (payment.discount) {
                        await DatabaseClient.releasePartyFormV2Discount(input.submissionId, payment.discount.id)
                        payment.discountReserved = false
                    }
                    await DatabaseClient.updatePartyFormV2Payment(input.submissionId, (current) =>
                        ['paid', 'completed'].includes(current.state) ? {} : { state: 'failed' }
                    )
                    throw error
                }
                // An ambiguous provider/network error is recoverable with the same checkout and
                // token. Keep the lease and original tender amounts; never invite a fresh charge.
                logError('Party payment awaiting reconciliation', error, {
                    submissionId: input.submissionId,
                    orderId: payment.orderId,
                })
                await DatabaseClient.updatePartyFormV2Payment(input.submissionId, (current) =>
                    ['paid', 'completed'].includes(current.state) ? {} : { state: 'paying', leaseUntil: 0 }
                )
                return { status: 'processing' }
            }
        }
    }

    try {
        if (payment.discount) {
            const discount = payment.discount
            await DatabaseClient.recordPartyFormV2DiscountRedemption(input.submissionId, {
                code: discount.code,
                normalizedCode: normalize(discount.code),
                customerEmail: payment.summary.parentEmail,
                normalizedCustomerEmail: normalize(payment.summary.parentEmail),
                redemptionKey: getDiscountCodeRedemptionKey(discount.code, payment.summary.parentEmail),
                customerName: `${payload.parentFirstName} ${payload.parentLastName}`,
                bookingType: 'party-form-v2',
                amountCents: payment.summary.totalCents,
                discountType: discount.discountType,
                discountAmount: discount.discountAmount,
                appointmentIds: [],
                idempotencyKey: input.submissionId,
                usedAt: new Date(),
            })
        }
        await processPartyFormV2Submission(input.submissionId)
        await DatabaseClient.updatePartyFormV2Payment(input.submissionId, () => ({ state: 'completed' }))
        return { status: 'completed', receiptUrl: payment.receiptUrl }
    } catch (error) {
        logError('Paid party form awaiting completion', error, {
            submissionId: input.submissionId,
            orderId: payment.orderId,
        })
        return { status: 'processing' }
    }
}
