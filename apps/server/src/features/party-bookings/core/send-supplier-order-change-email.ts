import { DateTime } from 'luxon'

import { capitalise, getStudioAddress, getStudioContactEmail, orderedQuantities, TAKE_HOME_BAGS } from '@fizz-kidz/core'
import type { Booking, Studio } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

/**
 * Tells the supplier that a party's existing order changed: a new order, a new delivery studio, or a cancelled order.
 * The supplier only ever gets the cake and take-home bags (not kits), so a party without either sends nothing. The
 * studio the order is for gets a copy.
 */
export async function sendSupplierOrderChangeEmail(input: {
    booking: Booking
    heading: string
    summary: string
    /** For a party that moved studio, where it moved from. */
    previousStudio?: Studio
    /** The studio the order is (or was) delivered to. */
    orderStudio: Studio
}) {
    const { booking, heading, summary, previousStudio, orderStudio } = input
    const takeHomeBags = orderedQuantities(booking.takeHomeBags).map(([key, quantity]) => ({
        name: TAKE_HOME_BAGS[key].displayValue,
        quantity: quantity.toString(),
    }))
    if (!booking.cake && takeHomeBags.length === 0) return

    const studioDisplay = (studio: Studio) => `${capitalise(studio)} - ${getStudioAddress(studio)}`
    const dateTime = DateTime.fromJSDate(booking.dateTime, { zone: 'Australia/Melbourne' }).toFormat(
        "ccc d LLL yyyy 'at' h:mm a"
    )
    const parentName = `${booking.parentFirstName} ${booking.parentLastName}`

    const mailClient = await MailClient.getInstance()
    await mailClient.sendEmail(
        'partySupplierOrderChange',
        env === 'prod' ? 'orders@birthdaycakeshop.com.au' : 'ryansaffer@gmail.com',
        {
            heading,
            summary,
            parentName,
            dateTime,
            mobile: booking.parentMobile,
            email: booking.parentEmail,
            ...(previousStudio && { previousStudio: studioDisplay(previousStudio) }),
            studio: studioDisplay(booking.location),
            ...(booking.cake && {
                cake: {
                    selection: booking.cake.selection,
                    size: booking.cake.size,
                    flavours: booking.cake.flavours.join(', '),
                    served: booking.cake.served,
                    candles: booking.cake.candles,
                    message: booking.cake.message,
                },
            }),
            hasTakeHomeBags: takeHomeBags.length > 0,
            takeHomeBags,
        },
        {
            subject: `${heading} - ${parentName}, ${dateTime}`,
            bcc: [getStudioContactEmail(orderStudio, env)],
        }
    )
}
