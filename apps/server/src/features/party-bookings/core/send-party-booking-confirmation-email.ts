import { DateTime } from 'luxon'

import type { Booking } from '@fizz-kidz/core'
import {
    capitalise,
    getApplicationDomain,
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

import { env } from '@/app/init/firebase'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

type SendPartyBookingConfirmationEmailInput = {
    bookingId: string
    booking: Booking
    header?: string
    openingLine?: string
    subject?: string
}

export async function sendPartyBookingConfirmationEmail({
    bookingId,
    booking,
    header,
    openingLine,
    subject,
}: SendPartyBookingConfirmationEmailInput) {
    const end = getPartyEndDate(booking.dateTime, booking.partyLength)
    const bookingDateTime = DateTime.fromJSDate(booking.dateTime, { zone: 'Australia/Melbourne' })
    const startTime = `${bookingDateTime.toFormat('h:mm a')} - ${DateTime.fromJSDate(end, {
        zone: 'Australia/Melbourne',
    }).toFormat('h:mm a')}`

    const params = [
        `childName=${encodeURIComponent(booking.childName)}`,
        `childAge=${encodeURIComponent(booking.childAge)}`,
        `date=${encodeURIComponent(booking.dateTime.toISOString())}`,
        `time=${encodeURIComponent(startTime)}`,
        `type=${encodeURIComponent(booking.type)}`,
        `studio=${encodeURIComponent(booking.location)}`,
        `address=${encodeURIComponent(booking.address)}`,
        `rsvpName=${encodeURIComponent(booking.parentFirstName)}`,
        `rsvpDate=${encodeURIComponent(bookingDateTime.minus({ days: 14 }).toISO())}`,
        `rsvpNumber=${encodeURIComponent(booking.parentMobile)}`,
    ]

    const invitationsUrl = booking.useRsvpSystem
        ? getInvitationEntryUrl(env, isUsingEmulator(), bookingId)
        : `${getApplicationDomain(env, isUsingEmulator())}/invitations?${params.join('&')}`

    const customerContact = getPartyCustomerContactInfo(booking.location)
    const studioContactEmail = getStudioContactEmail(booking.location)
    const birthdayChildDisplay = getPartyBirthdayChildDisplay(booking)
    const mailClient = await MailClient.getInstance()

    await mailClient.sendEmail(
        'partyBookingConfirmation',
        booking.parentEmail,
        {
            header: header ?? `${booking.childName}'s party is booked in!`,
            openingLine:
                openingLine ??
                `We're delighted to confirm <strong>${birthdayChildDisplay} Birthday Party at Fizz Kidz!</strong> We're so excited to celebrate with you.`,
            parentName: booking.parentFirstName,
            childName: booking.childName,
            childAge: booking.childAge,
            startDate: bookingDateTime.toLocaleString(DateTime.DATE_HUGE),
            startTime: bookingDateTime.toLocaleString(DateTime.TIME_SIMPLE),
            endTime: DateTime.fromJSDate(end, { zone: 'Australia/Melbourne' }).toLocaleString(DateTime.TIME_SIMPLE),
            address: booking.type === 'mobile' ? booking.address : getStudioAddress(booking.location),
            location: capitalise(booking.location),
            isMobile: booking.type === 'mobile',
            contactEmail: customerContact.email,
            contactPhone: customerContact.phoneDisplay,
            contactName: customerContact.contactName || '',
            numberOfKidsAllowed: getPartyChildCapacityMessages(booking.location),
            studioPhotoUrl: getPictureOfStudioUrl(booking.location),
            useRsvpSystem: booking.useRsvpSystem || false,
            invitationsUrl,
            includesFood: booking.includesFood,
            canOrderCake: canOrderCake(booking.type, booking.location),
            cakeFormUrl: getCakeFormUrl(bookingId),
        },
        { subject, replyTo: studioContactEmail }
    )
}
