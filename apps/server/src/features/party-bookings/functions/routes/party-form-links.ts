import express from 'express'

import { getPartyFormPageUrl } from '@/features/party-bookings/core/party-form/party-form-urls'

const NOT_FOUND_REDIRECT = 'https://www.fizzkidz.com.au/404'

/**
 * The party and cake form links we send (`/forms/party?id=…` and `/forms/cake?id=…`), resolved when clicked so links
 * already sent always reach the current form. Firebase hosting sends `/forms/**` here.
 */
export const partyFormLinks = express.Router()

partyFormLinks.get('/:mode(party|cake)', (req, res) => {
    const bookingId = req.query.id
    const mode = req.params.mode === 'cake' ? 'cake' : 'party'
    res.redirect(
        303,
        typeof bookingId === 'string' && bookingId ? getPartyFormPageUrl(mode, bookingId) : NOT_FOUND_REDIRECT
    )
})
