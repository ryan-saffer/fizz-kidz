import { DateTime } from 'luxon'

import type { Booking } from '@fizz-kidz/core'
import {
    capitalise,
    getApplicationDomain,
    getStudioAddress,
    getPartyEndDate,
    getPartyBirthdayChildDisplay,
    getStudioNotificationEmails,
} from '@fizz-kidz/core'

import { sendPartyBookingConfirmationEmail } from './send-party-booking-confirmation-email'
import { movePartyOrders } from './studio-move/move-party-orders'
import { validateBookingCreations } from './validate-booking-creations'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { CalendarClient } from '@/integrations/google/calendar.client'
import { logError } from '@/integrations/observability/log-error'
import { ZohoClient } from '@/integrations/zoho/zoho.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

/**
 * Saves an edited booking and keeps everything linked to it in line. A party can change studio (see
 * `studio-move/README.md`), but not between studio and mobile.
 */
export async function updatePartyBooking(input: { bookingId: string; booking: Booking }) {
    const { bookingId, booking } = input

    // serialize datetime back
    booking.dateTime = new Date(booking.dateTime)

    const existingBooking = await DatabaseClient.getPartyBooking(bookingId)
    if (booking.type !== existingBooking.type)
        throwTrpcError('BAD_REQUEST', 'a party cannot change between studio and mobile', null, input)
    if (!booking.eventId) throwTrpcError('PRECONDITION_FAILED', 'booking is missing event id', null, input)

    await validateBookingCreations(booking, existingBooking)

    const previousStudio = existingBooking.location
    const isMoving = booking.location !== previousStudio
    const calendarClient = await CalendarClient.getInstance()
    const event = {
        title: `${booking.parentFirstName} / ${getPartyBirthdayChildDisplay(booking)} ${booking.parentMobile}`,
        location: booking.type === 'mobile' ? booking.address : getStudioAddress(booking.location),
        start: booking.dateTime,
        end: getPartyEndDate(booking.dateTime, booking.partyLength),
    }

    // each studio has its own calendar (mobile parties share one), so a moved studio party gets a new event there
    const previousEventId = booking.eventId
    const isChangingCalendar = isMoving && booking.type === 'studio'
    if (isChangingCalendar) {
        try {
            booking.eventId = await calendarClient.createEvent(
                { eventType: 'party-bookings', type: booking.type, location: booking.location },
                {
                    ...event,
                    description: `${getApplicationDomain(env, isUsingEmulator())}/dashboard/bookings?id=${bookingId}`,
                }
            )
        } catch (err) {
            throwTrpcError(
                'INTERNAL_SERVER_ERROR',
                `error creating calendar event for moved booking '${bookingId}'`,
                err
            )
        }
    }

    await DatabaseClient.updatePartyBooking(bookingId, booking)

    if (isChangingCalendar) {
        try {
            await calendarClient.deleteEvent(previousEventId, {
                eventType: 'party-bookings',
                type: booking.type,
                location: previousStudio,
            })
        } catch (err) {
            logError('party moved studio, but unable to delete the calendar event at the previous studio', err, {
                input,
                previousStudio,
                previousEventId,
            })
        }
    } else {
        try {
            await calendarClient.updateEvent(
                booking.eventId,
                { eventType: 'party-bookings', type: booking.type, location: booking.location },
                event
            )
        } catch (err) {
            throwTrpcError(
                'INTERNAL_SERVER_ERROR',
                `error updating calendar event for booking with id: '${bookingId}'`,
                err
            )
        }
    }

    if (isMoving) await movePartyOrders({ bookingId, booking, previousStudio })

    const isSameTime = existingBooking.dateTime.getTime() === booking.dateTime.getTime()
    const isSameLength = existingBooking.partyLength === booking.partyLength
    if (isSameTime && isSameLength && !isMoving) return

    // confirm the new time or studio with the parent in writing. The studio that lost the party gets a copy, and the
    // new studio is who the parent replies to.
    const birthdayChildDisplay = getPartyBirthdayChildDisplay(booking)
    const studio = capitalise(booking.location)
    const bookingDateTime = DateTime.fromJSDate(booking.dateTime, { zone: 'Australia/Melbourne' })
    await sendPartyBookingConfirmationEmail({
        bookingId,
        booking,
        header: isMoving
            ? `${booking.childName}'s party has moved to Fizz Kidz ${studio}`
            : `${booking.childName}'s party time has been updated`,
        openingLine:
            isMoving && (!isSameTime || !isSameLength)
                ? `We've moved ${birthdayChildDisplay} birthday party to our ${studio} studio and updated its time. Here are the updated details:`
                : isMoving
                  ? `We've moved ${birthdayChildDisplay} birthday party to our ${studio} studio. Here are the updated details:`
                  : `We've updated the time for ${birthdayChildDisplay} birthday party. Here is the updated date and time:`,
        subject: `Party booking updated for ${booking.childName} - ${bookingDateTime.toFormat("ccc d LLL 'at' h:mm a")}`,
        ...(isMoving && { bcc: getStudioNotificationEmails(previousStudio, env) }),
        // invitations keep the details they were made with, so the parent updates theirs
        hasInvitationToUpdate: !!booking.invitationId,
    }).catch((err) =>
        logError('after updating party booking, unable to send email to parent confirming the changes', err, {
            input,
        })
    )

    if (booking.zohoDealId) {
        const zohoClient = new ZohoClient()
        await zohoClient
            .updatePartyDeal(booking.zohoDealId, {
                partyDateISO: booking.dateTime.toISOString(),
                studio: booking.location,
            })
            .catch((err) => logError('after updating party booking, error updating the zoho deal', err, { booking }))
    }
}
