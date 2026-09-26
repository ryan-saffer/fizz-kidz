import express from 'express'

import { DocumentNotFoundError } from '@/integrations/firebase/document-not-found-error'
import { logError } from '@/integrations/observability/log-error'
import {
    buildHostedPaperformClientUrl,
    type HostedPaperform,
} from '@/integrations/paperforms/core/hosted-paperform-url'
import { getPartyFormEmbedConfig } from '@/integrations/paperforms/core/party-form-prefill'

const NOT_FOUND_REDIRECT = 'https://www.fizzkidz.com.au/404'
const ERROR_REDIRECT = 'https://fizzkidz.com.au/form-result?result=error'

export const hostedPaperformRedirect = express.Router()

/**
 * Public entry point for all our paperforms.
 * Redirects to the client. Customers are sent here to ensure backwards compatability should this redirect destination change.
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

            // for validation only - failures will be caught and redirected
            await getPartyFormEmbedConfig(bookingId, form)
        }

        // TODO(party-form-v2 rollout): every party and cake form link we send lands here, including links sent months ago.
        // Pilot: redirect 'party' bookings at the pilot studio to `${getApplicationDomain(env)}/party-form-v2?id=<bookingId>`
        // and 'cake' bookings to the same page with `&mode=cake`, leaving every other studio on the Paperform.
        // Full launch: redirect all of them, which also moves old links over.
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
