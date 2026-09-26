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
    totalCents: number
    giftCardCents: number
    giftCardLast4: string
    cardCents: number
    items: { label: string; amountCents: number }[]
}
