import { TRPCError } from '@trpc/server'

import { getApplicationDomain, type CheckoutProgram } from '@fizz-kidz/core'

import { readCheckoutMetadata } from './checkout-order'

import { env } from '@/app/init/firebase'
import { logError } from '@/integrations/observability/log-error'
import { SquareClient } from '@/integrations/square/square.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

/**
 * Must match the notification URL of the Square webhook subscription exactly, as Square signs it. It was set up for
 * party checkout, and now serves every terminal checkout.
 */
export const TERMINAL_CHECKOUT_WEBHOOK_URL = `${getApplicationDomain(env, isUsingEmulator())}/api/webhooks/party-checkout`

/** A terminal checkout that has finished (paid or cancelled), for the booking flow that started it to settle. */
export type FinishedTerminalCheckout = {
    /** The Square order being paid for. */
    checkoutId: string
    terminalCheckoutId: string
    /** The booking flow's reference on the terminal checkout, e.g. its booking id. */
    referenceId: string | null
    /** The order's metadata, including the booking flow's own entries. */
    metadata: Record<string, string>
}

/** How each booking flow settles its finished terminal checkouts, just as its iPad does when it checks. */
export type TerminalCheckoutSettlers = Partial<Record<CheckoutProgram, (checkout: FinishedTerminalCheckout) => unknown>>

type TerminalCheckoutEvent = {
    type?: string
    data?: { object?: { checkout?: { id?: string; order_id?: string; reference_id?: string; status?: string } } }
}

/**
 * Square calls this when a terminal checkout changes. Once it's finished, the booking flow that started it settles it
 * (the order is paid with the terminal payment, or a cancelled one releases the gift card), so a payment completes
 * even when the iPad isn't watching. Returns the HTTP status for Square: anything other than 2xx makes Square send the
 * event again.
 */
export async function handleTerminalCheckoutWebhook(
    input: { rawBody: string; signature: string; body: unknown },
    settlers: TerminalCheckoutSettlers
) {
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
    if (!signatureKey) {
        logError('SQUARE_WEBHOOK_SIGNATURE_KEY is not set, so terminal checkout webhooks are ignored')
        return 500
    }
    const { WebhooksHelper } = await import('square')
    const trusted = await WebhooksHelper.verifySignature({
        requestBody: input.rawBody,
        signatureHeader: input.signature,
        signatureKey,
        notificationUrl: TERMINAL_CHECKOUT_WEBHOOK_URL,
    })
    if (!trusted) return 403

    const event = input.body as TerminalCheckoutEvent
    const checkout = event.data?.object?.checkout
    const finished = checkout?.status === 'COMPLETED' || checkout?.status === 'CANCELED'
    if (event.type !== 'terminal.checkout.updated' || !finished) return 200
    if (!checkout.id || !checkout.order_id) return 200

    try {
        const square = await SquareClient.getInstance()
        const { order } = await square.orders.get({ orderId: checkout.order_id })
        const program = order ? readCheckoutMetadata(order)?.program : undefined
        // not one of our checkouts (e.g. a charge from another app on the same Square account)
        const settle = program && settlers[program]
        if (!settle) return 200
        await settle({
            checkoutId: checkout.order_id,
            terminalCheckoutId: checkout.id,
            referenceId: checkout.reference_id ?? null,
            metadata: Object.fromEntries(
                Object.entries(order?.metadata ?? {}).flatMap(([key, value]) => (value ? [[key, value]] : []))
            ),
        })
        return 200
    } catch (error) {
        logError('Unable to settle a terminal checkout from its Square webhook', error, { checkout })
        // a refused request (a different booking, say) won't succeed on a retry; anything else might
        return error instanceof TRPCError && error.code === 'BAD_REQUEST' ? 200 : 500
    }
}
