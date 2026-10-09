import type { DiscountCodeRedemption } from '../discount-codes'

/** The booking flows that take payments through the shared server payments module. */
export type CheckoutProgram = DiscountCodeRedemption['bookingType']

/** A server-priced checkout: what the customer is charged, and how it is split between gift card and card. */
export type CheckoutSummary = {
    /** The unpaid Square order being paid for. */
    checkoutId: string
    locationId: string
    customerEmail: string
    subtotalCents: number
    discountCents: number
    discountCode: string
    /** A discount the booking flow applied itself, after the discount code. */
    orderDiscountCents: number
    totalCents: number
    giftCardCents: number
    giftCardLast4: string
    cardCents: number
    items: { label: string; amountCents: number }[]
}

/** Cents as Australian dollars, e.g. 69800 → '$698.00'. */
export function formatCents(cents: number) {
    return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
