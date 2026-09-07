import express from 'express'

import { PARTY_FORM_V2_ERROR_REDIRECT, PARTY_FORM_V2_SUCCESS_REDIRECT } from '@fizz-kidz/core'

import { processPartyFormV2Submission } from '@/features/party-bookings/core/party-form-v2/process-party-form-v2'
import { logError } from '@/integrations/observability/log-error'

export const partyFormV2Routes = express.Router()

/**
 * Completes a custom party form submission that required payment.
 * Square payment links redirect here after a successful payment.
 *
 * Idempotent based on submissionId (redirect URLs can be hit multiple times).
 */
partyFormV2Routes.get('/party-form-v2/form-complete', async (req, res) => {
    const submissionId = req.query.submissionId
    if (!submissionId || typeof submissionId !== 'string') {
        logError('party form v2 submitted for completion but there was no submissionId', undefined, {
            requestUrl: req.url,
        })
        res.redirect(303, PARTY_FORM_V2_ERROR_REDIRECT)
        return
    }

    try {
        await processPartyFormV2Submission(submissionId)
        res.redirect(303, PARTY_FORM_V2_SUCCESS_REDIRECT)
    } catch (err) {
        logError('Error processing party form v2 submission', err, { submissionId })
        res.redirect(303, PARTY_FORM_V2_ERROR_REDIRECT)
    }
})
