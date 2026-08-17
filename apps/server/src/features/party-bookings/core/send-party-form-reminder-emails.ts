import { logger } from 'firebase-functions/v2'

import type { Booking } from '@fizz-kidz/core'
import { getPartyCustomerContactInfo, getStudioContactEmail } from '@fizz-kidz/core'

import { getUpcoming } from './party-form-scheduling'
import { getPartyFormUrl } from './party-form-urls'

import { FirestoreRefs } from '@/integrations/firebase/firestore.refs'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

export async function sendPartyFormReminderEmails() {
    // since this runs on a Monday, it will get tomorrow
    const startDate = getUpcoming('Tuesday')
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 7)

    logger.log({ startDate })
    logger.log({ endDate })

    const bookingsRef = await FirestoreRefs.partyBookings()
    const querySnapshot = await bookingsRef.where('dateTime', '>', startDate).where('dateTime', '<', endDate).get()

    const result = await Promise.allSettled(
        querySnapshot.docs.map((snap) => {
            const bookingId = snap.id
            const firestoreBooking = snap.data()
            const booking = {
                ...firestoreBooking,
                dateTime: firestoreBooking.dateTime.toDate(),
            } satisfies Booking

            if (!firestoreBooking.partyFormFilledIn) {
                return sendFormReminder(bookingId, booking)
            } else {
                return Promise.resolve()
            }
        })
    )

    result.map((it, idx) => {
        if (it.status === 'rejected') {
            logError(`error sending party form reminder for booking with id: '${querySnapshot.docs[idx]}'`)
        }
    })
}

async function sendFormReminder(bookingId: string, booking: Booking) {
    const mailClient = await MailClient.getInstance()

    const prefilledFormUrl = getPartyFormUrl(bookingId)
    const customerContact = getPartyCustomerContactInfo(booking.location)
    const studioContactEmail = getStudioContactEmail(booking.location)

    return mailClient.sendEmail(
        'partyFormReminder',
        booking.parentEmail,
        {
            parentName: booking.parentFirstName,
            childName: booking.childName,
            contactPhone: customerContact.phoneDisplay,
            contactSignoff: customerContact.contactSignoff,
            contactName: customerContact.contactName || '',
            prefilledFormUrl,
        },
        {
            replyTo: studioContactEmail,
        }
    )
}
