import { canOrderCake, getStudioContactEmail, type Booking } from '@fizz-kidz/core'

import { getUpcoming } from './party-form-scheduling'
import { getCakeFormUrl } from './party-form-urls'

import { timestampConverter } from '@/integrations/firebase/firestore-converters'
import { FirestoreRefs } from '@/integrations/firebase/firestore.refs'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

/**
 *  Runs every Tuesday.
 *  Sends cake form to parties 3-4 weeks away. Skips parties that already ordered a cake or take-home bag.
 *  Excludes at-home parties.
 */
export async function sendCakeForms() {
    // since this runs on a Tuesday, it will get Tuesday in one week from today.
    // then add 14 days to get parties in three weekends time
    const startDate = getUpcoming('Tuesday')
    startDate.setDate(startDate.getDate() + 14)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 7)

    const bookingsRef = await FirestoreRefs.partyBookings()
    const querySnapshot = await bookingsRef
        .where('dateTime', '>', startDate)
        .where('dateTime', '<', endDate)
        .withConverter(timestampConverter)
        .get()

    // filter out bookings that have already ordered a cake or take home bag
    const bookings = querySnapshot.docs.filter((doc) => {
        const booking = doc.data() as Booking
        const eligible = canOrderCake(booking.type, booking.location)
        const alreadyOrderedSomething =
            !!booking.cake ||
            Object.keys(booking.takeHomeBags || {}).length > 0 ||
            Object.keys(booking.products || {}).length > 0
        return eligible && !alreadyOrderedSomething
    })

    const mailClient = await MailClient.getInstance()
    await Promise.all(
        bookings.map(async (doc) => {
            const booking = doc.data() as Booking
            await mailClient.sendEmail(
                'cakeForm',
                booking.parentEmail,
                {
                    parentName: booking.parentFirstName,
                    childName: booking.childName,
                    prefilledFormUrl: getCakeFormUrl(doc.id),
                },
                {
                    replyTo: getStudioContactEmail(booking.location),
                }
            )
        })
    )
}
