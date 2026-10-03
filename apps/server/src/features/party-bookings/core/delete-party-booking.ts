import { STOCKED_PARTY_ORDER_STUDIOS } from '@fizz-kidz/core'

import { deleteInvitationV2 } from './rsvp/delete-invitation-v2'

import type { DeletePartyBooking } from '../functions/trpc/parties.trpc'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { releaseInventoryForBooking } from '@/features/inventory/core/inventory.reservations'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { CalendarClient } from '@/integrations/google/calendar.client'
import { logError } from '@/integrations/observability/log-error'
import { ZohoClient } from '@/integrations/zoho/zoho.client'

export async function deletePartyBooking(props: DeletePartyBooking) {
    const { eventId, type, location, bookingId } = props
    const calendarClient = await CalendarClient.getInstance()

    try {
        await calendarClient.deleteEvent(eventId, { eventType: 'party-bookings', type, location })
    } catch (err) {
        throwTrpcError('INTERNAL_SERVER_ERROR', `error deleting party booking with id: '${bookingId}'`, err)
    }

    const existingBooking = await DatabaseClient.getPartyBooking(bookingId)
    if (existingBooking.zohoDealId) {
        try {
            const zohoClient = new ZohoClient()
            await zohoClient.markPartyDealClosedLost(
                existingBooking.zohoDealId,
                props.lostReason,
                props.lostReasonOtherDetails
            )
        } catch (err) {
            logError('Error marking party booking as closed lost while deleting', err, props)
        }
    }

    // if this party has an invitation, delete it
    if (existingBooking.invitationId) {
        await deleteInvitationV2(existingBooking.invitationId)
    }

    // give back any cake or take-home bags reserved from studio stock
    if (existingBooking.type === 'studio' && STOCKED_PARTY_ORDER_STUDIOS.includes(existingBooking.location)) {
        try {
            await releaseInventoryForBooking({ location: existingBooking.location, bookingId })
        } catch (err) {
            logError('Error releasing inventory reserved for a deleted party booking', err, props)
        }
    }

    await DatabaseClient.deletePartyBooking(bookingId)
}
