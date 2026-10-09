import { Button } from '@shared/components/ui/button'

import { MAX_PAYMENT_CHECKS, usePartyFormStore } from '../../state/party-form-store'
import { LoadingState } from '../common/loading-state'
import { Section } from '../common/section'

/**
 * Shown while a payment's outcome is unclear: after paying, or after a reload in a tab with an unconfirmed payment,
 * so the same payment is checked instead of a second checkout being started.
 */
export function PaymentStatus() {
    const paying = usePartyFormStore((state) => state.paying)
    const attempt = usePartyFormStore((state) => state.attempt)
    const checks = usePartyFormStore((state) => state.paymentChecks)
    const error = usePartyFormStore((state) => state.error)
    const { checkPayment, startOver } = usePartyFormStore.getState()

    const message =
        checks >= MAX_PAYMENT_CHECKS
            ? 'Your payment is taking longer than expected to confirm. Please don’t pay again. Email us at bookings@fizzkidz.com.au and we’ll check it for you.'
            : checks > 0
              ? 'Your payment or party details are still processing. Please check again shortly.'
              : 'Please confirm your previous payment before starting another checkout.'

    return (
        <Section title="Payment status" aria-live="polite">
            {paying ? (
                <LoadingState
                    title="Checking your payment"
                    description="This can take a few seconds. Please keep this page open."
                />
            ) : (
                <>
                    <p className="mb-4">{message}</p>
                    {error && (
                        <p role="alert" className="mb-4 text-red-600">
                            {error}
                        </p>
                    )}
                    {attempt ? (
                        <Button type="button" onClick={() => void checkPayment()}>
                            Check payment status
                        </Button>
                    ) : (
                        // the payment definitely failed after a reload, so nothing was charged
                        <Button type="button" onClick={startOver}>
                            Return to party details
                        </Button>
                    )}
                </>
            )}
        </Section>
    )
}
