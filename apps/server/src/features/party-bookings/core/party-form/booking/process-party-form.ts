import {
    getSquareLocationId,
    mapProductToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    orderedQuantities,
    type Booking,
    type PartyForm,
} from '@fizz-kidz/core'

import { applyPartyForm } from './apply-party-form'
import { getPartyFormBookingCake } from './get-party-form-booking-update'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { logError } from '@/integrations/observability/log-error'
import { SquareClient } from '@/integrations/square/square.client'

/**
 * Saves the submission (see `partyFormSubmissions`) and applies it to the booking (booking update, emails,
 * analytics; see `applyPartyForm`). Called by `submitPartyForm` once anything paid now is paid. A submission is
 * applied once: replaying it after `bookingApplied` is set does nothing.
 */
export async function processPartyFormSubmission(submissionId: string, payload: PartyForm, checkoutId: string | null) {
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
    // one cake per party is checked when preparing, so a different cake is one ordered (e.g. in another tab) since then
    const cake = getPartyFormBookingCake(payload)
    if (cake && booking.cake && JSON.stringify(cakeSummary(booking.cake)) !== JSON.stringify(cakeSummary(cake)))
        logError('Party form paid for a second cake; the booking cake was replaced and may need a refund', undefined, {
            submissionId,
            bookingId: payload.bookingId,
            previousCake: booking.cake.selection,
            newCake: cake.selection,
        })
    await restoreTakeHomeInventory(submissionId, payload, booking)
    await applyPartyForm(payload, booking)
    await DatabaseClient.markPartyFormSubmissionApplied(submissionId)
}

/**
 * Square removes tracked inventory when goodies are sold, but they're ordered from the supplier for each party, so the
 * stock is put back. Best effort.
 */
async function restoreTakeHomeInventory(submissionId: string, payload: PartyForm, booking: Booking) {
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

const cakeSummary = ({ selection, size, flavours, served, candles }: NonNullable<Booking['cake']>) => [
    selection,
    size,
    [...flavours].sort(),
    served,
    candles,
]
