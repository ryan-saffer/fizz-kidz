import { TRPCError } from '@trpc/server'

import { getApplicationDomain } from '@fizz-kidz/core'

import { getPartyCheckoutStatus } from './charge-party-checkout'

import { env } from '@/app/init/firebase'
import { logError } from '@/integrations/observability/log-error'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

/** Must match the notification URL of the Square webhook subscription exactly, as Square signs it. */
export const PARTY_CHECKOUT_WEBHOOK_URL = `${getApplicationDomain(env, isUsingEmulator())}/api/webhooks/party-checkout`

type TerminalCheckoutEvent = {
    type?: string
    data?: { object?: { checkout?: { id?: string; order_id?: string; reference_id?: string; status?: string } } }
}

/**
 * Square calls this when a terminal checkout changes. Once it's finished, the charge is settled exactly as the iPad
 * does when it checks: a paid charge is recorded on the booking, a cancelled one releases the gift card. This records
 * payments even when the iPad isn't watching. Returns the HTTP status for Square: anything other than 2xx makes
 * Square send the event again.
 */
export async function handlePartyCheckoutWebhook(input: { rawBody: string; signature: string; body: unknown }) {
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
    if (!signatureKey) {
        logError('SQUARE_WEBHOOK_SIGNATURE_KEY is not set, so party checkout webhooks are ignored')
        return 500
    }
    const { WebhooksHelper } = await import('square')
    const trusted = await WebhooksHelper.verifySignature({
        requestBody: input.rawBody,
        signatureHeader: input.signature,
        signatureKey,
        notificationUrl: PARTY_CHECKOUT_WEBHOOK_URL,
    })
    if (!trusted) return 403

    const event = input.body as TerminalCheckoutEvent
    const checkout = event.data?.object?.checkout
    const finished = checkout?.status === 'COMPLETED' || checkout?.status === 'CANCELED'
    if (event.type !== 'terminal.checkout.updated' || !finished) return 200
    if (!checkout.id || !checkout.order_id || !checkout.reference_id) return 200

    try {
        await getPartyCheckoutStatus({
            bookingId: checkout.reference_id,
            checkoutId: checkout.order_id,
            terminalCheckoutId: checkout.id,
        })
        return 200
    } catch (error) {
        logError('Unable to settle a party checkout from its Square webhook', error, { checkout })
        // a refused request (not one of our checkouts, say) won't succeed on a retry; anything else might
        return error instanceof TRPCError && error.code === 'BAD_REQUEST' ? 200 : 500
    }
}
