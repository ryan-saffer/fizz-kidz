import type { CheckoutProgram, DiscountCode } from '@fizz-kidz/core'

import type { Square } from 'square'

/** The Square order discount holding the customer's discount code. */
export const DISCOUNT_CODE_UID = 'discount-code'

/**
 * What a checkout remembers between preparing and paying. It lives on the Square order, not in our database. Square
 * allows ten metadata entries per order; these take seven and leave the rest to the booking flow.
 */
export type CheckoutMetadata = {
    program: CheckoutProgram
    customerEmail: string
    customerName: string
    discountCode: string
    discountCodeId: string
    giftCardId: string
    giftCardCents: number
}

/** Square rejects empty metadata values, so entries without a value are left off (and read back as empty). */
export function writeCheckoutMetadata(metadata: CheckoutMetadata): Record<string, string> {
    const entries: Record<keyof CheckoutMetadata, string> = {
        program: metadata.program,
        customerEmail: metadata.customerEmail,
        customerName: metadata.customerName,
        discountCode: metadata.discountCode,
        discountCodeId: metadata.discountCodeId,
        giftCardId: metadata.giftCardId,
        giftCardCents: metadata.giftCardCents > 0 ? String(metadata.giftCardCents) : '',
    }
    return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== ''))
}

/** Reads a checkout back from its Square order, or null if the order wasn't created by a checkout. */
export function readCheckoutMetadata(order: Square.Order): CheckoutMetadata | null {
    const metadata = order.metadata ?? {}
    if (!metadata.program || !metadata.customerEmail) return null
    return {
        program: metadata.program as CheckoutProgram,
        customerEmail: metadata.customerEmail,
        customerName: metadata.customerName ?? '',
        discountCode: metadata.discountCode ?? '',
        discountCodeId: metadata.discountCodeId ?? '',
        giftCardId: metadata.giftCardId ?? '',
        giftCardCents: Number(metadata.giftCardCents ?? 0),
    }
}

/**
 * A discount code's value against `baseCents` (the order total before the code), at most the whole order. 'price'
 * codes are in dollars.
 */
export function getDiscountCodeCents(
    discount: Pick<DiscountCode, 'discountType' | 'discountAmount'>,
    baseCents: number
) {
    const cents =
        discount.discountType === 'percentage'
            ? Math.round((baseCents * discount.discountAmount) / 100)
            : Math.round(discount.discountAmount * 100)
    return Math.min(cents, baseCents)
}
