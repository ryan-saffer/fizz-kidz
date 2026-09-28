import { z } from 'zod'

import { PARTY_FORM_V2_ADDITIONS } from './party-form-v2'

import type { CheckoutSummary } from '../payments/checkout'
import type { TerminalCheckoutStatus } from '../payments/terminal-checkout'

/**
 * Collecting payment for a studio party once it's over: the party price per child (at least `MIN_CHARGED_CHILDREN`,
 * see `square-party-price.ts`), the food additions, an optional staff discount and gift card, charged on the studio's
 * Square Terminal.
 */

export const preparePartyCheckoutSchema = z
    .object({
        bookingId: z.string().min(1),
        partyLength: z.enum(['1.5', '2']),
        includesFood: z.boolean(),
        /** The children who came; fewer than the minimum are charged as the minimum. */
        childrenCount: z.number().int().min(1).max(200),
        additions: z
            .array(z.enum(PARTY_FORM_V2_ADDITIONS))
            .refine((additions) => new Set(additions).size === additions.length, 'Additions must be unique'),
        discountCents: z.number().int().min(0).default(0),
        /** Why staff gave the discount. Kept on the order and booking for us, not shown to the customer. */
        discountReason: z.string().trim().max(200).default(''),
        giftCardNumber: z.string().trim().max(40).default(''),
    })
    .refine((checkout) => checkout.discountCents === 0 || checkout.discountReason.length > 0, {
        message: 'A discount needs a reason',
        path: ['discountReason'],
    })

export type PreparePartyCheckout = z.infer<typeof preparePartyCheckoutSchema>

/** What staff are about to charge, priced by Square. The staff discount is the summary's `orderDiscountCents`. */
export type PartyCheckoutSummary = CheckoutSummary

export const startPartyCheckoutSchema = z.object({
    bookingId: z.string().min(1),
    checkoutId: z.string().min(1),
    deviceId: z.string().min(1),
})

export const partyTerminalCheckoutSchema = z.object({
    bookingId: z.string().min(1),
    checkoutId: z.string().min(1),
    terminalCheckoutId: z.string().min(1),
})

export type StartPartyCheckout = z.infer<typeof startPartyCheckoutSchema>
export type PartyTerminalCheckout = z.infer<typeof partyTerminalCheckoutSchema>

/** Where a party charge is up to on the terminal. */
export type PartyCheckoutStatus = TerminalCheckoutStatus

/** The payment on a party booking, recorded once it's collected. */
export type PartyPayment = {
    squareOrderId: string
    totalCents: number
    giftCardCents: number
    discountCents: number
    discountReason?: string
    chargedChildren: number
    receiptUrl: string | null
    /** ISO date time */
    paidAt: string
}
