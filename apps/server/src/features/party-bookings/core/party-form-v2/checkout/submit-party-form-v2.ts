import { randomUUID } from 'crypto'

import type { SubmitPartyFormV2 } from '@fizz-kidz/core'

import { processPartyFormV2Submission } from '../booking/process-party-form-v2'
import { getCheckoutMetadata } from './prepare-party-form-v2'
import { validatePartyFormV2 } from './validate-party-form-v2'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { payCheckout } from '@/features/payments/core/pay-checkout'
import { logError } from '@/integrations/observability/log-error'

export type SubmitPartyFormV2Result = { status: 'completed'; receiptUrl: string | null } | { status: 'processing' }

/** Pays the checkout (when there is one), then saves the submission and applies it to the booking. */
export async function submitPartyFormV2({
    payload,
    checkoutId,
    token,
    buyerVerificationToken,
}: SubmitPartyFormV2): Promise<SubmitPartyFormV2Result> {
    if (!checkoutId) {
        // nothing was paid, so errors reach the customer, who can submit again
        const { lineItems } = await validatePartyFormV2(payload)
        if (lineItems.length > 0) throwTrpcError('BAD_REQUEST', 'Please refresh the payment summary.')
        await processPartyFormV2Submission(randomUUID(), payload, null)
        return { status: 'completed', receiptUrl: null }
    }

    const payment = await payCheckout({
        checkoutId,
        token,
        buyerVerificationToken,
        metadata: getCheckoutMetadata(payload),
    })
    if (payment.status === 'processing') return payment
    try {
        // saved under the order id, so a replay finds it and doesn't apply it twice
        await processPartyFormV2Submission(checkoutId, payload, checkoutId)
        return { status: 'completed', receiptUrl: payment.receiptUrl }
    } catch (error) {
        // Paid but not yet applied. Replaying finds the paid order and retries only the booking update.
        logError('Paid party form awaiting completion', error, { checkoutId, bookingId: payload.bookingId })
        return { status: 'processing' }
    }
}
