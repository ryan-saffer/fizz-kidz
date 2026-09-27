import { DateTime } from 'luxon'

import {
    capitalise,
    formatCents,
    getPartyBirthdayChildDisplay,
    getPartyCustomerContactInfo,
    getStudioContactEmail,
    type Booking,
    type PartyPayment,
} from '@fizz-kidz/core'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { describeItem } from '@/features/payments/core/prepare-checkout'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

/**
 * Square doesn't email receipts for Terminal API payments, so the parent gets our own: the itemised charge and a link
 * to Square's receipt.
 */
export async function sendPartyPaymentReceipt(booking: Booking, order: Square.Order, payment: PartyPayment) {
    const contact = getPartyCustomerContactInfo(booking.location)
    const mailClient = await MailClient.getInstance()
    await mailClient.sendEmail(
        'partyPaymentReceipt',
        booking.parentEmail,
        {
            parentName: booking.parentFirstName,
            birthday: getPartyBirthdayChildDisplay(booking),
            date: DateTime.fromJSDate(booking.dateTime, { zone: 'Australia/Melbourne' }).toFormat('cccc d LLLL yyyy'),
            studio: `${capitalise(booking.location)} studio`,
            lines: getPartyPaymentLines(order),
            discount: payment.discountCents > 0 ? formatCents(payment.discountCents) : '',
            giftCard: payment.giftCardCents > 0 ? formatCents(payment.giftCardCents) : '',
            total: formatCents(payment.totalCents),
            receiptUrl: payment.receiptUrl ?? '',
            contactEmail: contact.email,
            contactPhone: contact.phoneDisplay,
        },
        {
            subject: `Your receipt for ${getPartyBirthdayChildDisplay(booking)} birthday party`,
            replyTo: getStudioContactEmail(booking.location, env),
        }
    )
}

/** The order's lines, each priced before the discount, which has its own line. */
export function getPartyPaymentLines(order: Square.Order) {
    return (order.lineItems ?? []).map((line) => ({
        label: `${line.quantity} × ${describeItem(line)}`,
        amount: formatCents(
            Number(line.variationTotalPriceMoney?.amount ?? 0) +
                (line.modifiers ?? []).reduce((sum, modifier) => sum + Number(modifier.totalPriceMoney?.amount ?? 0), 0)
        ),
    }))
}
