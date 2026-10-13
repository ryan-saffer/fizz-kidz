import { randomUUID } from 'crypto'

import type { SubmitPartyForm } from '@fizz-kidz/core'

import { processPartyFormSubmission } from '../booking/process-party-form'
import { getCheckoutMetadata } from './prepare-party-form'
import { validatePartyForm } from './validate-party-form'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { payCheckout } from '@/features/payments/core/pay-checkout'
import { logError } from '@/integrations/observability/log-error'

export type SubmitPartyFormResult = { status: 'completed'; receiptUrl: string | null } | { status: 'processing' }

/** Pays the checkout (when there is one), then saves the submission and applies it to the booking. */
export async function submitPartyForm({
    payload,
    checkoutId,
    token,
    buyerVerificationToken,
}: SubmitPartyForm): Promise<SubmitPartyFormResult> {
    if (!checkoutId) {
        // nothing was paid, so errors reach the customer, who can submit again
        const { lineItems } = await validatePartyForm(payload)
        if (lineItems.length > 0) throwTrpcError('BAD_REQUEST', 'Please refresh the payment summary.')
        await processPartyFormSubmission(randomUUID(), payload, null)
        return { status: 'completed', receiptUrl: null }
    }

    const payment = await payCheckout({
        checkoutId,
        token,
        buyerVerificationToken,
        metadata: getCheckoutMetadata(payload),
        // the summary may have been prepared a while ago, so check again (eg. the last cake sold since) before charging
        revalidate: () => validatePartyForm(payload),
    })
    if (payment.status === 'processing') return payment
    try {
        // saved under the order id, so a replay finds it and doesn't apply it twice
        await processPartyFormSubmission(checkoutId, payload, checkoutId)
        return { status: 'completed', receiptUrl: payment.receiptUrl }
    } catch (error) {
        // Paid but not yet applied. Replaying finds the paid order and retries only the booking update.
        logError('Paid party form awaiting completion', error, { checkoutId, bookingId: payload.bookingId })
        return { status: 'processing' }
    }
}
