import { DateTime } from 'luxon'

import { formatCents, type Booking, type PartyPayment } from '@fizz-kidz/core'

import { getPartyPaymentLines } from './send-party-payment-receipt'

import type { Square } from 'square'

import { ZohoClient } from '@/integrations/zoho/zoho.client'

/** Puts what was paid on the party's Zoho deal: its amount, and a note with the breakdown. */
export async function syncPartyPaymentToZoho(booking: Booking, order: Square.Order, payment: PartyPayment) {
    if (!booking.zohoDealId) return
    await new ZohoClient().recordPartyPayment({
        dealId: booking.zohoDealId,
        amountCents: payment.totalCents,
        note: getPartyPaymentNote(order, payment),
    })
}

export function getPartyPaymentNote(order: Square.Order, payment: PartyPayment) {
    const paidAt = DateTime.fromISO(payment.paidAt, { zone: 'Australia/Melbourne' }).toFormat('ccc d LLL yyyy, h:mm a')
    return [
        `Paid ${formatCents(payment.totalCents)} on the studio's Square Terminal, ${paidAt}`,
        '',
        ...getPartyPaymentLines(order).map((line) => `${line.label}: ${line.amount}`),
        ...(payment.discountCents > 0
            ? [`Discount: -${formatCents(payment.discountCents)} (${payment.discountReason || 'no reason given'})`]
            : []),
        ...(payment.giftCardCents > 0 ? [`Paid by gift card: ${formatCents(payment.giftCardCents)}`] : []),
        `Total: ${formatCents(payment.totalCents)}`,
        '',
        ...(payment.receiptUrl ? [`Receipt: ${payment.receiptUrl}`] : []),
        `Square order: ${payment.squareOrderId}`,
    ].join('\n')
}
