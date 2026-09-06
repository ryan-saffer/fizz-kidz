import { Timestamp } from 'firebase-admin/firestore'

import type { FirestoreBooking } from '@fizz-kidz/core'
import { getApplicationDomain, getStudioAddress, getPartyEndDate, getPartyBirthdayChildDisplay } from '@fizz-kidz/core'

import { sendPartyBookingConfirmationEmail } from './send-party-booking-confirmation-email'
import { validateBookingCreations } from './validate-booking-creations'

import type { CreatePartyBooking } from '../functions/trpc/parties.trpc'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { CalendarClient } from '@/integrations/google/calendar.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'
import { ZohoClient } from '@/integrations/zoho/zoho.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export async function createPartyBooking(_booking: CreatePartyBooking) {
    await validateBookingCreations(_booking)

    const booking = {
        ..._booking,
        dateTime: Timestamp.fromDate(new Date(_booking.dateTime)),
    } satisfies FirestoreBooking

    const bookingId = await DatabaseClient.createPartyBooking(booking)

    const end = getPartyEndDate(booking.dateTime.toDate(), booking.partyLength)
    const birthdayChildDisplay = getPartyBirthdayChildDisplay(booking)

    const calendarClient = await CalendarClient.getInstance()
    let eventId: string
    try {
        eventId = await calendarClient.createEvent(
            {
                eventType: 'party-bookings',
                type: booking.type,
                location: booking.location,
            },
            {
                title: `${booking.parentFirstName} / ${birthdayChildDisplay} ${booking.parentMobile}`,
                start: booking.dateTime.toDate(),
                end,
                location: booking.type === 'mobile' ? booking.address : getStudioAddress(booking.location),
                description: `${getApplicationDomain(env, isUsingEmulator())}/dashboard/bookings?id=${bookingId}`,
            }
        )
    } catch (err) {
        await DatabaseClient.deletePartyBooking(bookingId)
        throwTrpcError('INTERNAL_SERVER_ERROR', 'unable to create calendar event', err)
    }

    await DatabaseClient.updatePartyBooking(bookingId, { eventId })

    const zohoClient = new ZohoClient()
    try {
        const zohoContactId = await zohoClient.addBirthdayPartyContact({
            firstName: booking.parentFirstName,
            lastName: booking.parentLastName,
            email: booking.parentEmail,
            mobile: booking.parentMobile,
            partyDate: booking.dateTime.toDate(),
            studio: booking.location,
            type: booking.type,
            optOutOfMarketing: false,
        })

        const zohoDealId = await zohoClient.confirmBirthdayPartyDealAndLinkChild({
            bookingId,
            dealId: booking.zohoDealId,
            parentContactId: zohoContactId,
            partyDateISO: booking.dateTime.toDate().toISOString(),
            parentName: `${booking.parentFirstName} ${booking.parentLastName}`.trim(),
            address: booking.type === 'mobile' ? booking.address : '',
            studio: booking.location,
            type: booking.type,
            children: booking.children!,
        })

        // if there wasn't an existing deal in zoho when the booking was created, write the id back into the database
        if (!booking.zohoDealId) {
            await DatabaseClient.updatePartyBooking(bookingId, { zohoDealId })
        }
    } catch (err) {
        logError('error creating zoho records during birthday party booking', err, { booking })
    }

    if (booking.sendConfirmationEmail) {
        try {
            await sendPartyBookingConfirmationEmail({
                bookingId,
                booking: { ..._booking, dateTime: new Date(_booking.dateTime) },
            })
        } catch (err) {
            logError('party booked successfully, but unable to send confirmation email', err, { _booking })
        }
    }

    // analytics
    const mixpanel = await MixpanelClient.getInstance()
    await mixpanel.track('birthday-party-booking', {
        distinct_id: booking.parentEmail,
        bookingId,
        location: booking.location,
        length: booking.partyLength,
        includesFood: booking.includesFood,
        type: booking.type,
        childAge: booking.childAge,
        date: booking.dateTime.toDate().toISOString(),
        useRsvpSystem: booking.useRsvpSystem || false,
    })
}
