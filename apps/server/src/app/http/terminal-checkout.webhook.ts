import express from 'express'

import type { Studio } from '@fizz-kidz/core'

import { getPartyCheckoutStatus } from '@/features/party-bookings/core/party-checkout/charge-party-checkout'
import { handleTerminalCheckoutWebhook } from '@/features/payments/core/handle-terminal-checkout-webhook'
import { getPosStatus } from '@/features/pos/core/charge-pos'

export const terminalCheckoutWebhook = express.Router()

// the path the Square webhook subscriptions were set up with, when only parties used the terminal
terminalCheckoutWebhook.post('/party-checkout', async (req, res) => {
    const status = await handleTerminalCheckoutWebhook(
        {
            // Cloud Functions keep the raw body, which Square's signature covers
            rawBody: (req as { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '',
            signature: req.header('x-square-hmacsha256-signature') ?? '',
            body: req.body,
        },
        {
            // a paid party is recorded on its booking
            'party-checkout': (checkout) =>
                getPartyCheckoutStatus({
                    bookingId: checkout.metadata.bookingId ?? '',
                    checkoutId: checkout.checkoutId,
                    terminalCheckoutId: checkout.terminalCheckoutId,
                }),
            pos: (checkout) =>
                getPosStatus({
                    studio: checkout.metadata.studio as Studio,
                    checkoutId: checkout.checkoutId,
                    terminalCheckoutId: checkout.terminalCheckoutId,
                }),
        }
    )
    res.sendStatus(status)
})
