import {
    getSquareLocationId,
    mapProductToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    orderedQuantities,
    type Booking,
    type PartyFormV2,
} from '@fizz-kidz/core'

import { buildPartyFormV2Submission, partyFormV2BookingCake } from '../build-party-form-v2-submission'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { handlePartyFormSubmission } from '@/features/party-bookings/core/handle-party-form-submission'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { logError } from '@/integrations/observability/log-error'
import { SquareClient } from '@/integrations/square/square.client'

/**
 * Saves the submission (see `partyFormSubmissions`) and applies it to the booking through the Paperform pipeline
 * (booking update, emails, analytics). Called by `submitPartyFormV2` once anything paid now is paid. A submission is
 * applied once: replaying it after `bookingApplied` is set does nothing.
 */
export async function processPartyFormV2Submission(
    submissionId: string,
    payload: PartyFormV2,
    checkoutId: string | null
) {
    const submission = await DatabaseClient.getPartyFormSubmission(submissionId)
    if (submission?.bookingApplied) return
    if (!submission)
        await DatabaseClient.createPartyFormSubmission(submissionId, {
            bookingId: payload.bookingId,
            payload,
            checkoutId,
            bookingApplied: false,
            createdAt: new Date(),
        })

    const booking = await DatabaseClient.getPartyBooking(payload.bookingId)
    await restoreTakeHomeInventory(submissionId, payload, booking)
    await handlePartyFormSubmission(
        buildPartyFormV2Submission(payload, booking, submissionId),
        partyFormV2BookingCake(payload)
    )
    await DatabaseClient.markPartyFormSubmissionApplied(submissionId)
}

/**
 * Square removes tracked inventory when goodies are sold, but they're ordered from the supplier for each party, so the
 * stock is put back. Best effort.
 */
async function restoreTakeHomeInventory(submissionId: string, payload: PartyFormV2, booking: Booking) {
    const changes = [
        ...orderedQuantities(payload.takeHomeBags).map(([key, quantity]) => ({
            catalogObjectId: mapTakeHomeBagToSquareVariation(env, key),
            quantity,
        })),
        ...orderedQuantities(payload.products).map(([key, quantity]) => ({
            catalogObjectId: mapProductToSquareVariation(env, key),
            quantity,
        })),
    ].map(
        ({ catalogObjectId, quantity }): Square.InventoryChange => ({
            type: 'ADJUSTMENT',
            adjustment: {
                catalogObjectId,
                locationId: getSquareLocationId(env === 'prod' ? booking.location : 'test'),
                quantity: String(quantity),
                fromState: 'NONE',
                toState: 'IN_STOCK',
                occurredAt: new Date().toISOString(),
            },
        })
    )
    if (changes.length === 0) return
    try {
        const square = await SquareClient.getInstance()
        await square.inventory.batchCreateChanges({ idempotencyKey: `${submissionId}-inventory`, changes })
    } catch (error) {
        logError('Unable to restore Square inventory for party form goodies', error, { submissionId })
    }
}
