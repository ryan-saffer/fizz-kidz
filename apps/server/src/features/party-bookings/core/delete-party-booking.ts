import { capitalise, isStockedPartyOrder } from '@fizz-kidz/core'

import { deleteInvitation } from './rsvp/delete-invitation'
import { sendPartyCancellationEmail } from './send-party-cancellation-email'
import { sendSupplierOrderChangeEmail } from './send-supplier-order-change-email'

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
        await deleteInvitation(existingBooking.invitationId)
    }

    // give back any cake or take-home bags reserved from studio stock, or cancel them with the supplier
    if (isStockedPartyOrder(existingBooking.type, existingBooking.location)) {
        try {
            await releaseInventoryForBooking({ location: existingBooking.location, bookingId })
        } catch (err) {
            logError('Error releasing inventory reserved for a deleted party booking', err, props)
        }
    } else {
        try {
            await sendSupplierOrderChangeEmail({
                booking: existingBooking,
                orderStudio: existingBooking.location,
                heading: 'Order cancelled',
                summary: `This party at ${capitalise(existingBooking.location)} has been cancelled. Please cancel the order below.`,
            })
        } catch (err) {
            logError('party booking deleted, but unable to email the supplier to cancel its order', err, props)
        }
    }

    await DatabaseClient.deletePartyBooking(bookingId)

    try {
        await sendPartyCancellationEmail(existingBooking)
    } catch (err) {
        logError('party booking deleted, but unable to send the cancellation email', err, props)
    }
}
