import express from 'express'

import type { Studio } from '@fizz-kidz/core'

import { DatabaseClient } from '@/integrations/firebase/database.client'
import { DocumentNotFoundError } from '@/integrations/firebase/document-not-found-error'
import { logError } from '@/integrations/observability/log-error'
import {
    buildCustomPartyFormUrl,
    buildHostedPaperformClientUrl,
    type HostedPaperform,
} from '@/integrations/paperforms/core/hosted-paperform-url'

const NOT_FOUND_REDIRECT = 'https://www.fizzkidz.com.au/404'
const ERROR_REDIRECT = 'https://fizzkidz.com.au/form-result?result=error'

/** Studios whose party and cake form links open the custom party form rather than the Paperform. */
const CUSTOM_PARTY_FORM_PILOT_STUDIOS: Studio[] = ['malvern']

export const hostedPaperformRedirect = express.Router()

/**
 * Public entry point for all our paperforms.
 * Redirects to the client. Customers are sent here to ensure backwards compatability should this redirect destination change.
 * Every party and cake form link (emails and the portal's copy-link buttons) lands here.
 *
 * Firebase hosting redirects here from 'https://bookings.fizzkidz.com.au/forms'
 */
hostedPaperformRedirect.get('/:form', async (req, res) => {
    const form = req.params.form

    if (!isHostedPaperform(form)) {
        res.redirect(303, NOT_FOUND_REDIRECT)
        return
    }

    const params = getStringParams(req.query)

    try {
        if (form === 'party' || form === 'cake') {
            const bookingId = params.id
            if (!bookingId) {
                res.redirect(303, NOT_FOUND_REDIRECT)
                return
            }

            // TODO(party-form-v2 rollout): once the pilot is done, send every booking to the custom form. This also moves
            // links sent before launch over, since they all land here.
            const booking = await DatabaseClient.getPartyBooking(bookingId)
            if (CUSTOM_PARTY_FORM_PILOT_STUDIOS.includes(booking.location)) {
                res.redirect(303, buildCustomPartyFormUrl(form, bookingId))
                return
            }
        }

        res.redirect(303, buildHostedPaperformClientUrl(form, params))
        return
    } catch (err) {
        if (err instanceof DocumentNotFoundError) {
            res.redirect(303, NOT_FOUND_REDIRECT)
            return
        }

        logError('Error redirecting to hosted Paperform route', err, {
            form,
            requestUrl: req.url,
            params,
        })
        res.redirect(303, ERROR_REDIRECT)
        return
    }
})

function isHostedPaperform(form: string): form is HostedPaperform {
    return ['party', 'cake', 'onboarding', 'incursion', 'incident-reporting', 'staff-feedback'].includes(form)
}

function getStringParams(query: Record<string, unknown>) {
    const params: Record<string, string> = {}

    Object.entries(query).forEach(([key, value]) => {
        if (typeof value === 'string') {
            params[key] = value
        }
    })

    return params
}
