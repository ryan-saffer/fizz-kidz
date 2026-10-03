import {
    getSquareLocationId,
    isStockedPartyOrder,
    mapProductToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    orderedQuantities,
    type Booking,
    type PartyFormV2,
} from '@fizz-kidz/core'

import { buildPartyFormV2Submission, partyFormV2BookingCake } from '../build-party-form-v2-submission'
import { getPartyFormV2CakeOptions } from '../options/get-party-form-v2-cake-options'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { getOrderableInventory, reserveInventoryForBooking } from '@/features/inventory/core/inventory.reservations'
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
    // one cake per party is checked when preparing, so a different cake is one ordered (e.g. in another tab) since then
    const cake = partyFormV2BookingCake(payload)
    if (cake && booking.cake && JSON.stringify(cakeSummary(booking.cake)) !== JSON.stringify(cakeSummary(cake)))
        logError('Party form paid for a second cake; the booking cake was replaced and may need a refund', undefined, {
            submissionId,
            bookingId: payload.bookingId,
            previousCake: booking.cake.selection,
            newCake: cake.selection,
        })
    await restoreTakeHomeInventory(submissionId, payload, booking)
    await reserveStudioStock(submissionId, payload, booking)
    await handlePartyFormSubmission(buildPartyFormV2Submission(payload, booking, submissionId), cake)
    await DatabaseClient.markPartyFormSubmissionApplied(submissionId)
}

/**
 * At studios that sell from studio stock, the paid cake and any linked bags or kits are reserved for the party so
 * nobody else can order them. Not best effort: a failure leaves the submission unapplied, and a replay retries it
 * (reserving is safe to repeat).
 */
async function reserveStudioStock(submissionId: string, payload: PartyFormV2, booking: Booking) {
    if (!isStockedPartyOrder(booking.type, booking.location)) return

    const orderable = await getOrderableInventory(booking.location)
    const lines: { itemId: string; quantity: number }[] = []
    if (payload.cake) {
        const { designs } = await getPartyFormV2CakeOptions(booking.location)
        const designId = designs.find((design) => design.name === payload.cake?.selection)?.id
        const stock = designId ? orderable.get(designId) : undefined
        if (stock) lines.push({ itemId: stock.item.id, quantity: 1 })
        else
            logError('Paid studio-stock cake has no linked inventory item, so it was not reserved', undefined, {
                submissionId,
                selection: payload.cake.selection,
            })
    }
    const takeHome = [
        ...orderedQuantities(payload.takeHomeBags).map(([key, quantity]) => ({
            id: mapTakeHomeBagToSquareVariation(env, key),
            quantity,
        })),
        ...orderedQuantities(payload.products).map(([key, quantity]) => ({
            id: mapProductToSquareVariation(env, key),
            quantity,
        })),
    ]
    takeHome.forEach(({ id, quantity }) => {
        const stock = orderable.get(id)
        if (stock) lines.push({ itemId: stock.item.id, quantity })
    })
    if (lines.length === 0) return

    await reserveInventoryForBooking({
        location: booking.location,
        bookingId: payload.bookingId,
        reservationId: submissionId,
        lines,
    })
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

const cakeSummary = ({ selection, size, flavours, served, candles }: NonNullable<Booking['cake']>) => [
    selection,
    size,
    [...flavours].sort(),
    served,
    candles,
]
