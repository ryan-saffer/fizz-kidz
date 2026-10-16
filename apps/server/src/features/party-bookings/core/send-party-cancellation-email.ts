import { DateTime } from 'luxon'

import type { Booking } from '@fizz-kidz/core'
import {
    capitalise,
    getPartyCustomerContactInfo,
    getPartyEndDate,
    getStudioAddress,
    getStudioContactEmail,
    getStudioNotificationEmails,
} from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

/**
 * Confirms a cancelled party with the parent in writing, with our cancellation policy. Any fee is left to the bookings
 * team, who email the parent directly. The studio inbox (and owner, for a franchise) get a copy.
 */
export async function sendPartyCancellationEmail(booking: Booking) {
    const start = DateTime.fromJSDate(booking.dateTime, { zone: 'Australia/Melbourne' })
    const end = DateTime.fromJSDate(getPartyEndDate(booking.dateTime, booking.partyLength), {
        zone: 'Australia/Melbourne',
    })
    const customerContact = getPartyCustomerContactInfo(booking.location)
    const mailClient = await MailClient.getInstance()

    await mailClient.sendEmail(
        'partyBookingCancellation',
        booking.parentEmail,
        {
            parentName: booking.parentFirstName,
            childName: booking.childName,
            startDate: start.toLocaleString(DateTime.DATE_HUGE),
            startTime: start.toLocaleString(DateTime.TIME_SIMPLE),
            endTime: end.toLocaleString(DateTime.TIME_SIMPLE),
            address: booking.type === 'mobile' ? booking.address : getStudioAddress(booking.location),
            location: capitalise(booking.location),
            isMobile: booking.type === 'mobile',
            contactEmail: customerContact.email,
            contactPhone: customerContact.phoneDisplay,
            contactSignoff: customerContact.contactSignoff,
        },
        {
            subject: `Party booking cancelled for ${booking.childName} - ${start.toFormat("ccc d LLL 'at' h:mm a")}`,
            replyTo: getStudioContactEmail(booking.location, env),
            bcc: getStudioNotificationEmails(booking.location, env),
        }
    )
}
