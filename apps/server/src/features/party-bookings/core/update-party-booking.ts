import { DateTime } from 'luxon'

import type { Booking } from '@fizz-kidz/core'
import {
    capitalise,
    getInvitationEntryUrl,
    getStudioAddress,
    getPartyChildCapacityMessages,
    getPartyCustomerContactInfo,
    getPartyEndDate,
    getPictureOfStudioUrl,
    getStudioContactEmail,
    getPartyBirthdayChildDisplay,
    canOrderCake,
} from '@fizz-kidz/core'

import { getCakeFormUrl } from './party-form-urls'
import { validateBookingCreations } from './validate-booking-creations'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { CalendarClient } from '@/integrations/google/calendar.client'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { ZohoClient } from '@/integrations/zoho/zoho.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export async function updatePartyBooking(input: { bookingId: string; booking: Booking }) {
    const { bookingId, booking } = input

    // serialize datetime back
    booking.dateTime = new Date(booking.dateTime)

    const existingBooking = await DatabaseClient.getPartyBooking(bookingId)
    await validateBookingCreations(booking, existingBooking)
    await DatabaseClient.updatePartyBooking(bookingId, booking)

    const calendarClient = await CalendarClient.getInstance()
    const birthdayChildDisplay = getPartyBirthdayChildDisplay(booking)

    if (!booking.eventId) throwTrpcError('PRECONDITION_FAILED', 'booking is missing event id', null, input)

    try {
        await calendarClient.updateEvent(
            booking.eventId,
            { eventType: 'party-bookings', type: booking.type, location: booking.location },
            {
                title: `${booking.parentFirstName} / ${birthdayChildDisplay} ${booking.parentMobile}`,
                location: booking.type === 'mobile' ? booking.address : getStudioAddress(booking.location),
                start: booking.dateTime,
                end: getPartyEndDate(booking.dateTime, booking.partyLength),
            }
        )
    } catch (err) {
        throwTrpcError(
            'INTERNAL_SERVER_ERROR',
            `error updating calendar event for booking with id: '${bookingId}'`,
            err
        )
    }

    const isSameTime = existingBooking.dateTime.getTime() === booking.dateTime.getTime()
    const isSameLength = existingBooking.partyLength === booking.partyLength

    // if the party time has changed, send an email to the parent so its confirmed in writing
    if (!isSameTime || !isSameLength) {
        const customerContact = getPartyCustomerContactInfo(booking.location)
        const studioContactEmail = getStudioContactEmail(booking.location, env)
        const mailClient = await MailClient.getInstance()
        const bookingDateTime = DateTime.fromJSDate(booking.dateTime, {
            zone: 'Australia/Melbourne',
        })

        const updatedBookingSubject = `Party booking updated for ${booking.childName} - ${bookingDateTime.toFormat(
            "ccc d LLL 'at' h:mm a"
        )}`

        const invitationsUrl = getInvitationEntryUrl(env, isUsingEmulator(), bookingId)

        await mailClient
            .sendEmail(
                'partyBookingConfirmation',
                booking.parentEmail,
                {
                    header: `${booking.childName}'s party time has been updated`,
                    openingLine: `We've updated the time for ${birthdayChildDisplay} birthday party. Here is the updated date and time:`,
                    parentName: booking.parentFirstName,
                    childName: booking.childName,
                    childAge: booking.childAge,
                    startDate: bookingDateTime.toLocaleString(DateTime.DATE_HUGE),
                    startTime: bookingDateTime.toLocaleString(DateTime.TIME_SIMPLE),
                    endTime: DateTime.fromJSDate(getPartyEndDate(booking.dateTime, booking.partyLength), {
                        zone: 'Australia/Melbourne',
                    }).toLocaleString(DateTime.TIME_SIMPLE),
                    address: booking.type === 'mobile' ? booking.address : getStudioAddress(booking.location),
                    location: capitalise(booking.location),
                    isMobile: booking.type === 'mobile',
                    contactEmail: customerContact.email,
                    contactPhone: customerContact.phoneDisplay,
                    contactName: customerContact.contactName || '',
                    numberOfKidsAllowed: getPartyChildCapacityMessages(booking.location),
                    studioPhotoUrl: getPictureOfStudioUrl(booking.location),
                    invitationsUrl,
                    includesFood: booking.includesFood,
                    canOrderCake: canOrderCake(booking.type, booking.location),
                    cakeFormUrl: getCakeFormUrl(bookingId),
                },
                {
                    subject: updatedBookingSubject,
                    replyTo: studioContactEmail,
                }
            )
            .catch((err) =>
                logError(
                    'after updating party booking, unable to send email to parent confirming new date and time',
                    err,
                    { input }
                )
            )

        if (booking.zohoDealId) {
            const zohoClient = new ZohoClient()
            await zohoClient
                .updatePartyDetailEventDate(booking.zohoDealId, booking.dateTime.toISOString())
                .catch((err) =>
                    logError('after updating party time, error updating event date in zoho deal', err, { booking })
                )
        }
    }
}
