import { randomUUID } from 'crypto'

import {
    getApplicationDomain,
    getSquareLocationId,
    mapCakeSizeToSquareVariation,
    mapCandleToSquareVariation,
    mapProductToSquareVariation,
    mapServingMethodToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    orderedQuantities,
    partyFormV2RequiresPayment,
    PARTY_FORM_V2_SUCCESS_REDIRECT,
    type PartyFormV2,
} from '@fizz-kidz/core'

import { PartyFormMapper } from '../party-form-mapper'
import { buildPartyFormV2Submission } from './build-party-form-v2-submission'
import { processPartyFormV2Submission } from './process-party-form-v2'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { SanityClient } from '@/integrations/sanity/sanity.client'
import { getOrCreateCustomer } from '@/integrations/square/core/get-or-create-customer'
import { SquareClient } from '@/integrations/square/square.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export type SubmitPartyFormV2Result =
    | { action: 'completed'; redirectUrl: string }
    | { action: 'payment'; paymentUrl: string }

/**
 * Handles a custom party form submission.
 *
 * If the customer chose items requiring payment (cake, take home bags, products), stores the
 * submission and returns a Square payment link whose redirect completes the form. Otherwise
 * processes the form immediately.
 */
export async function submitPartyFormV2(payload: PartyFormV2): Promise<SubmitPartyFormV2Result> {
    const booking = await DatabaseClient.getPartyBooking(payload.bookingId)

    if (booking.type === 'studio' && !payload.foodPackage) {
        throwTrpcError('BAD_REQUEST', 'The food package question is required for studio parties')
    }

    const submissionId = `v2-${randomUUID()}`
    const responses = buildPartyFormV2Submission(payload, booking, submissionId)

    // dry-run the mapping now, so an unresolvable creation fails the submission
    // instead of surfacing after the customer has paid
    const sanity = await SanityClient.getInstance()
    const catalogue = await sanity.getBirthdayPartyBookingCatalogue()
    try {
        new PartyFormMapper(responses, catalogue).mapToBooking(booking.type, booking.location)
    } catch (err) {
        throwTrpcError('BAD_REQUEST', 'The form contains selections that are no longer available', err, { payload })
    }

    await DatabaseClient.createPartyFormV2Submission(submissionId, payload.bookingId, payload)

    if (!partyFormV2RequiresPayment(payload)) {
        await processPartyFormV2Submission(submissionId)
        return { action: 'completed', redirectUrl: PARTY_FORM_V2_SUCCESS_REDIRECT }
    }

    const host = getApplicationDomain(env, isUsingEmulator())
    const square = await SquareClient.getInstance()
    const locationId = getSquareLocationId(env === 'prod' ? booking.location : 'test')
    const customerId = await getOrCreateCustomer(payload.parentFirstName, payload.parentLastName, booking.parentEmail)

    const takeHomeBags = orderedQuantities(payload.takeHomeBags)
    const products = orderedQuantities(payload.products)

    const { paymentLink } = await square.checkout.paymentLinks.create({
        idempotencyKey: randomUUID(),
        description: 'Party Form Checkout',
        checkoutOptions: {
            allowTipping: false,
            askForShippingAddress: false,
            merchantSupportEmail: 'bookings@fizzkidz.com.au',
            redirectUrl: `${host}/api/party-form-v2/form-complete?submissionId=${submissionId}`,
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
                ...(payload.cake
                    ? [
                          {
                              quantity: '1',
                              name: payload.cake.selection,
                              catalogObjectId: mapCakeSizeToSquareVariation(env, payload.cake.size),
                              modifiers: [
                                  {
                                      catalogObjectId: mapServingMethodToSquareVariation(env, payload.cake.served),
                                      quantity: '1',
                                  },
                                  {
                                      catalogObjectId: mapCandleToSquareVariation(env, payload.cake.candles),
                                      quantity: '1',
                                  },
                              ],
                          },
                      ]
                    : []),
                ...takeHomeBags.map(([sku, quantity]) => ({
                    quantity: quantity.toString(),
                    catalogObjectId: mapTakeHomeBagToSquareVariation(env, sku),
                })),
                ...products.map(([sku, quantity]) => ({
                    quantity: quantity.toString(),
                    catalogObjectId: mapProductToSquareVariation(env, sku),
                })),
            ],
        },
    })

    if (!paymentLink?.url) {
        throwTrpcError('INTERNAL_SERVER_ERROR', 'Square returned an empty payment link for the party form', undefined, {
            submissionId,
        })
    }

    return { action: 'payment', paymentUrl: paymentLink.url }
}
