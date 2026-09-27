import express from 'express'

import { handlePartyCheckoutWebhook } from '@/features/party-bookings/core/party-checkout/handle-party-checkout-webhook'

export const partyCheckoutWebhook = express.Router()

partyCheckoutWebhook.post('/party-checkout', async (req, res) => {
    const status = await handlePartyCheckoutWebhook({
        // Cloud Functions keep the raw body, which Square's signature covers
        rawBody: (req as { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '',
        signature: req.header('x-square-hmacsha256-signature') ?? '',
        body: req.body,
    })
    res.sendStatus(status)
})
