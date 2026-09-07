import {
    getSquareLocationId,
    mapProductToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    orderedQuantities,
} from '@fizz-kidz/core'

import { buildPartyFormV2Submission } from './build-party-form-v2-submission'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { handlePartyFormSubmission } from '@/features/party-bookings/core/handle-party-form-submission'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { logError } from '@/integrations/observability/log-error'
import { SquareClient } from '@/integrations/square/square.client'

/**
 * Processes a stored custom party form submission, running the same pipeline as the
 * Paperform '/party-form/form-complete' webhook (idempotency lock, Square inventory
 * reversal, database updates, emails, analytics).
 *
 * Only prepared submissions whose payment has completed may enter this workflow.
 */
export async function processPartyFormV2Submission(submissionId: string): Promise<'completed' | 'already-completed'> {
    const { bookingId, payload, payment } = await DatabaseClient.getPartyFormV2Submission(submissionId)
    if (!payment || (payment.state !== 'paid' && payment.state !== 'completed'))
        throw new Error('Party form payment has not completed')
    const booking = await DatabaseClient.getPartyBooking(bookingId)
    const responses = buildPartyFormV2Submission(payload, booking, submissionId)

    const claim = await DatabaseClient.claimPartyFormSubmissionProcessing(
        submissionId,
        bookingId,
        (record) =>
            record.status === 'failed' ||
            (record.status === 'processing' && record.updatedAt.getTime() < Date.now() - 120_000)
    )
    if (!claim.shouldProcess) {
        if (claim.status === 'completed') {
            return 'already-completed'
        }
        throw new Error(`Party form v2 submission '${submissionId}' previously failed processing`)
    }

    try {
        // Square automatically removes tracked inventory quantities.
        // Since these are ordered through the supplier, we don't want to change the inventory levels - so adjust it back here.
        const takeHomeBags = orderedQuantities(payload.takeHomeBags)
        const products = orderedQuantities(payload.products)
        if (takeHomeBags.length > 0 || products.length > 0) {
            const locationId = getSquareLocationId(env === 'prod' ? booking.location : 'test')
            const square = await SquareClient.getInstance()
            const changes: Square.InventoryChange[] = [
                ...takeHomeBags.map(([sku, quantity]) => ({
                    catalogObjectId: mapTakeHomeBagToSquareVariation(env, sku),
                    quantity: quantity.toString(),
                })),
                ...products.map(([sku, quantity]) => ({
                    catalogObjectId: mapProductToSquareVariation(env, sku),
                    quantity: quantity.toString(),
                })),
            ].map(({ catalogObjectId, quantity }) => ({
                type: 'ADJUSTMENT' as const,
                adjustment: {
                    catalogObjectId,
                    locationId,
                    quantity,
                    fromState: 'NONE' as const,
                    toState: 'IN_STOCK' as const,
                    occurredAt: new Date(payment.createdAt).toISOString(),
                },
            }))
            try {
                await square.inventory.batchCreateChanges({ idempotencyKey: `${submissionId}-inventory`, changes })
            } catch (err) {
                logError('Error adjusting inventory for square item during party form v2 payment', err, {
                    bookingId,
                    submissionId,
                })
            }
        }

        await handlePartyFormSubmission(responses, submissionId)
        await DatabaseClient.completePartyFormSubmissionProcessing(submissionId)
        return 'completed'
    } catch (err) {
        try {
            await DatabaseClient.failPartyFormSubmissionProcessing(submissionId, err)
        } catch (innerErr) {
            logError('Error marking party form v2 submission processing as failed', innerErr, {
                submissionId,
                bookingId,
            })
        }
        throw err
    }
}
