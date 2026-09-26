import { randomUUID } from 'crypto'

import express from 'express'

import {
    getApplicationDomain,
    getSquareLocationId,
    mapCakeSizeToSquareVariation,
    mapCandleToSquareVariation,
    mapProductToSquareVariation,
    mapServingMethodToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    type PartyForm,
    type ProductType,
    type TakeHomeBagType,
} from '@fizz-kidz/core'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { handlePartyFormSubmission } from '@/features/party-bookings/core/handle-party-form-submission'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { DocumentNotFoundError } from '@/integrations/firebase/document-not-found-error'
import { logError } from '@/integrations/observability/log-error'
import { buildHostedPaperformUrl } from '@/integrations/paperforms/core/hosted-paperform-url'
import { getPartyFormEmbedConfig } from '@/integrations/paperforms/core/party-form-prefill'
import { PaperformClient, type PaperformSubmission } from '@/integrations/paperforms/paperform.client'
import { getOrCreateCustomer } from '@/integrations/square/core/get-or-create-customer'
import { SquareClient } from '@/integrations/square/square.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

const SUCCESS_REDIRECT = 'https://fizzkidz.com.au/form-result?result=success'
const ERROR_REDIRECT = 'https://fizzkidz.com.au/form-result?result=error'
const NOT_FOUND_REDIRECT = 'https://www.fizzkidz.com.au/404'

export const partyFormRedirect = express.Router()

/**
 * BACKWARDS COMPAT ONLY
 *
 * Currently customers get sent to 'https://bookings.fizzkidz.com.au/forms?form=party'
 * Probably safe to delete by August 2026. Check cloud run networking to see if its getting hit ever.
 */
partyFormRedirect.get('/party-form', async (req, res) => {
    const bookingId = req.query.id as string

    try {
        await getPartyFormEmbedConfig(bookingId, 'party')

        res.redirect(303, buildHostedPaperformUrl('party', { id: bookingId }))
        return
    } catch (err) {
        if (err instanceof DocumentNotFoundError) {
            res.redirect(303, NOT_FOUND_REDIRECT)
            return
        }

        logError('Error redirecting to party form', err, { bookingId, requestUrl: req.url })
        res.redirect(303, ERROR_REDIRECT)
        return
    }
})

/**
 * BACKWARDS COMPAT ONLY
 *
 * Currently customers get sent to 'https://bookings.fizzkidz.com.au/forms?form=cake'
 * Probably safe to delete by August 2026. Check cloud run networking to see if its getting hit ever.
 */
partyFormRedirect.get('/cake-form', async (req, res) => {
    const bookingId = req.query.id as string

    try {
        await getPartyFormEmbedConfig(bookingId, 'cake')

        res.redirect(303, buildHostedPaperformUrl('cake', { id: bookingId }))
        return
    } catch (err) {
        if (err instanceof DocumentNotFoundError) {
            res.redirect(303, NOT_FOUND_REDIRECT)
            return
        }

        logError('Error redirecting to cake form', err, { bookingId, requestUrl: req.url })
        res.redirect(303, ERROR_REDIRECT)
        return
    }
})

/**
 * Given a paperform submission id, it redirects the customer to a Square Payment Link.
 *
 * Party form has custom redirect rules setup to decide whether or not to send this customer to this link.
 * When creating the payment link, it will setup '/party-form/form-complete' as the redirect url.
 */
partyFormRedirect.get('/party-form/payment-link', async (req, res) => {
    const submissionId = req.query.submissionId
    if (!submissionId || typeof submissionId !== 'string') {
        logError('party form submitted for checkout but there was no submissionId', undefined, { requestUrl: req.url })
        res.redirect(303, ERROR_REDIRECT)
        return
    }

    const paperformClient = new PaperformClient()

    let responses: PaperformSubmission<PartyForm>
    try {
        responses = await paperformClient.getPartyFormSubmission(submissionId)
    } catch (err) {
        logError(
            `party form submitted for checkout but there was an error fetching paperform submission with id: ${submissionId}`,
            err
        )
        res.redirect(303, ERROR_REDIRECT)
        return
    }

    const booking = await DatabaseClient.getPartyBooking(responses.getFieldValue('id'))

    const cake = responses.getFieldValue('cake')
    const cakeSize = responses.getFieldValue('cake_size')
    const cakeServing = responses.getFieldValue('cake_served')
    const cakeCandles = responses.getFieldValue('cake_candles')

    const takeHomeBags = responses.getFieldValue('take_home_bags') ?? []
    const products = responses.getFieldValue('products') ?? []

    const host = getApplicationDomain(env, isUsingEmulator())

    const orderedCake = cake !== 'I will bring my own cake'

    if (!orderedCake && takeHomeBags.length === 0 && products.length === 0) {
        // should not be in checkout flow. redirect to form-complete.
        res.redirect(303, `${host}/api/webhooks/party-form/form-complete?submissionId=${submissionId}`)
        return
    }

    try {
        const square = await SquareClient.getInstance()
        const locationId = getSquareLocationId(env === 'prod' ? booking.location : 'test')

        const customerId = await getOrCreateCustomer(
            responses.getFieldValue('parent_first_name'),
            responses.getFieldValue('parent_last_name'),
            booking.parentEmail
        )

        // Create payment link using checkout API
        const { paymentLink } = await square.checkout.paymentLinks.create({
            idempotencyKey: crypto.randomUUID(),
            description: 'Party Form Checkout',
            checkoutOptions: {
                allowTipping: false,
                askForShippingAddress: false,
                merchantSupportEmail: 'bookings@fizzkidz.com.au',
                redirectUrl: `${host}/api/webhooks/party-form/form-complete?submissionId=${submissionId}`,
            },
            prePopulatedData: {
                buyerEmail: booking.parentEmail,
            },
            order: {
                locationId,
                customerId,
                source: {
                    name: 'Party Form',
                },
                pricingOptions: {
                    autoApplyDiscounts: true,
                },
                lineItems: [
                    ...(orderedCake
                        ? [
                              {
                                  quantity: '1',
                                  name: cake,
                                  catalogObjectId: mapCakeSizeToSquareVariation(env, cakeSize),
                                  modifiers: [
                                      {
                                          catalogObjectId: mapServingMethodToSquareVariation(env, cakeServing),
                                          quantity: '1',
                                      },
                                      {
                                          catalogObjectId: mapCandleToSquareVariation(env, cakeCandles),
                                          quantity: '1',
                                      },
                                  ],
                              },
                          ]
                        : []),
                    ...takeHomeBags.map((item) => ({
                        quantity: item.quantity.toString(),
                        catalogObjectId: mapTakeHomeBagToSquareVariation(env, item.SKU as TakeHomeBagType),
                    })),
                    ...products.map((item) => ({
                        quantity: item.quantity.toString(),
                        catalogObjectId: mapProductToSquareVariation(env, item.SKU as ProductType),
                    })),
                ],
            },
        })

        if (paymentLink?.url) {
            res.redirect(303, paymentLink.url)
        } else {
            logError(`Payment link is empty for party form with submissionId: ${submissionId}`)
            res.redirect(303, ERROR_REDIRECT)
        }
        return
    } catch (error) {
        logError(`Error creating payment link for party form with submissionId: ${submissionId}`, error)
        res.redirect(303, ERROR_REDIRECT)
        return
    }
})

/**
 * Handles the party form submission.
 * Linked to by both the party form directly, or from the Square payment link if payment was required.
 *
 * This route is idempotent based on submissionId.
 */
partyFormRedirect.get('/party-form/form-complete', async (req, res) => {
    const submissionId = req.query.submissionId
    if (!submissionId || typeof submissionId !== 'string') {
        logError('party form submitted for completion but there was no submissionId', undefined, {
            requestUrl: req.url,
        })
        res.redirect(303, ERROR_REDIRECT)
        return
    }

    const paperformClient = new PaperformClient()

    let responses: PaperformSubmission<PartyForm>
    try {
        responses = await paperformClient.getPartyFormSubmission(submissionId)
    } catch (err) {
        logError(
            `party form submitted for completion but there was an error fetching paperform submission with id: ${submissionId}`,
            err
        )
        res.redirect(303, ERROR_REDIRECT)
        return
    }

    const bookingId = responses.getFieldValue('id')

    // Redirect URLs are not guaranteed to be called exactly once (refresh/back button/timeouts/etc),
    // so we need to guard against processing the same Paperform submission multiple times.
    try {
        const claim = await DatabaseClient.claimPartyFormSubmissionProcessing(submissionId, bookingId)
        if (!claim.shouldProcess) {
            res.redirect(303, claim.status === 'completed' ? SUCCESS_REDIRECT : ERROR_REDIRECT)
            return
        }
    } catch (err) {
        logError('Error claiming party form submission processing lock', err, { submissionId, bookingId })
        res.redirect(303, ERROR_REDIRECT)
        return
    }

    try {
        // Square automatically removes tracked inventory quantities.
        // Since these are ordered through the supplier, we don't want to change the inventory levels - so adjust it back here.
        const takeHomeBags = responses.getFieldValue('take_home_bags') ?? []
        const products = responses.getFieldValue('products') ?? []
        if (takeHomeBags.length > 0 || products.length > 0) {
            const booking = await DatabaseClient.getPartyBooking(bookingId)
            const locationId = getSquareLocationId(env === 'prod' ? booking.location : 'test')
            const square = await SquareClient.getInstance()
            const takeHomeBagChanges: Square.InventoryChange[] = takeHomeBags.map((item) => ({
                type: 'ADJUSTMENT',
                adjustment: {
                    catalogObjectId: mapTakeHomeBagToSquareVariation(env, item.SKU as TakeHomeBagType),
                    locationId,
                    quantity: item.quantity.toString(),
                    fromState: 'NONE',
                    toState: 'IN_STOCK',
                    occurredAt: new Date().toISOString(),
                },
            }))
            const productsChanges: Square.InventoryChange[] = products.map((product) => ({
                type: 'ADJUSTMENT',
                adjustment: {
                    catalogObjectId: mapProductToSquareVariation(env, product.SKU as ProductType),
                    locationId,
                    quantity: product.quantity.toString(),
                    fromState: 'NONE',
                    toState: 'IN_STOCK',
                    occurredAt: new Date().toISOString(),
                },
            }))
            try {
                await square.inventory.batchCreateChanges({
                    idempotencyKey: randomUUID(),
                    changes: [...takeHomeBagChanges, ...productsChanges],
                })
            } catch (err) {
                logError('Error adjusting inventory for square item during party form payment', err, {
                    bookingId,
                    submissionId,
                })
            }
        }

        // Handle the complete form submission (mapping, database updates, emails, etc.)
        await handlePartyFormSubmission(responses)
        await DatabaseClient.completePartyFormSubmissionProcessing(submissionId)
    } catch (err) {
        logError('Error processing party form submission', err, { submissionId, bookingId })
        try {
            await DatabaseClient.failPartyFormSubmissionProcessing(submissionId, err)
        } catch (innerErr) {
            logError('Error marking party form submission processing as failed', innerErr, { submissionId, bookingId })
        }
        res.redirect(303, ERROR_REDIRECT)
        return
    }

    res.redirect(303, SUCCESS_REDIRECT)
    return
})
