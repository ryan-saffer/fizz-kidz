import express from 'express'

import {
    buildHostedPaperformClientUrl,
    type HostedPaperform,
} from '@/integrations/paperforms/core/hosted-paperform-url'

const NOT_FOUND_REDIRECT = 'https://www.fizzkidz.com.au/404'

export const hostedPaperformRedirect = express.Router()

/**
 * Public entry point for our Paperforms (staff onboarding, incursions, incident reporting and staff feedback). Party
 * and cake form links are handled first by `party-form-links.ts`.
 * Redirects to the client. Customers are sent here to ensure backwards compatability should this redirect destination change.
 *
 * Firebase hosting redirects here from 'https://bookings.fizzkidz.com.au/forms'
 */
hostedPaperformRedirect.get('/:form', (req, res) => {
    const form = req.params.form

    if (!isHostedPaperform(form)) {
        res.redirect(303, NOT_FOUND_REDIRECT)
        return
    }

    res.redirect(303, buildHostedPaperformClientUrl(form, getStringParams(req.query)))
})

function isHostedPaperform(form: string): form is HostedPaperform {
    return ['onboarding', 'incursion', 'incident-reporting', 'staff-feedback'].includes(form)
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
