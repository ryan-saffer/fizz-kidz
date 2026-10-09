import { deleteInvitation } from './rsvp/delete-invitation'

import type { DeletePartyBooking } from '../functions/trpc/parties.trpc'

import { throwTrpcError } from '@/app/trpc/transport-errors'
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
        await deleteInvitation(existingBooking.invitationId)
    }

    await DatabaseClient.deletePartyBooking(bookingId)
}
