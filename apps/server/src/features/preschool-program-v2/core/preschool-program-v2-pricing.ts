import { FULL_TERM_DISCOUNT_PERCENTAGE, FULL_TERM_DISCOUNT_UID } from './preschool-program-v2-config'

import type { Square } from 'square'

type Discount = {
    discountType: 'percentage' | 'price'
    discountAmount: number
} | null

type DiscountLineItem = {
    amount: number
    isFullTermDiscount: boolean
}

/** Calculates the fixed cent amount sent to Square for a discount code after full-term discounts. */
export function getDiscountCodeAmountCents(input: { discount: Discount; lineItems: DiscountLineItem[] }) {
    if (!input.discount) return 0

    if (input.discount.discountType === 'price') {
        return Math.round(input.discount.discountAmount * 100)
    }

    const subtotalAfterFullTermDiscounts = input.lineItems.reduce((acc, item) => {
        const fullTermDiscount = item.isFullTermDiscount
            ? Math.round(item.amount * (FULL_TERM_DISCOUNT_PERCENTAGE / 100))
            : 0

        return acc + item.amount - fullTermDiscount
    }, 0)

    return Math.round(subtotalAfterFullTermDiscounts * (input.discount.discountAmount / 100))
}

/** Returns the refundable difference between net payments and the repriced remaining booking, floored at zero. */
export function calculateRefundCents(netPaidCents: bigint, repricedRemainingTotalCents: bigint) {
    const refundCents = netPaidCents - repricedRemainingTotalCents
    return refundCents > BigInt(0) ? refundCents : BigInt(0)
}

/** Reprices active order lines and removes full-term eligibility when any discounted term line was cancelled. */
export function repriceRemainingOrder(order: Square.Order, remainingLineItemIdentifiers: Set<string>) {
    const remainingLineItems = (order.lineItems || []).filter((lineItem) =>
        remainingLineItemIdentifiers.has(lineItem.metadata?.['lineItemIdentifier'] || '')
    )
    const originalFullTermLineIdentifiers = new Set(
        (order.lineItems || [])
            .filter(hasFullTermDiscountApplied)
            .map((lineItem) => lineItem.metadata?.['lineItemIdentifier'] || '')
            .filter(Boolean)
    )
    const fullTermStillEligible =
        originalFullTermLineIdentifiers.size > 0 &&
        [...originalFullTermLineIdentifiers].every((identifier) => remainingLineItemIdentifiers.has(identifier))

    const subtotalCents = remainingLineItems.reduce((acc, lineItem) => acc + getLineItemBaseAmountCents(lineItem), 0)
    const fullTermDiscountCents = fullTermStillEligible
        ? remainingLineItems.reduce((acc, lineItem) => {
              if (!hasFullTermDiscountApplied(lineItem)) return acc
              return acc + roundPercentageCents(getLineItemBaseAmountCents(lineItem), FULL_TERM_DISCOUNT_PERCENTAGE)
          }, 0)
        : 0
    const discountedSubtotalCents = subtotalCents - fullTermDiscountCents
    const discountCodeAmountCents = getRepricedDiscountCodeAmountCents(order, discountedSubtotalCents)

    return BigInt(Math.max(0, discountedSubtotalCents - discountCodeAmountCents))
}

/** Reports whether cancelling this line item is what breaks the order's full-term discount. */
export function isFullTermDiscountRemoved(
    order: Square.Order,
    remainingLineItemIdentifiers: Set<string>,
    cancelledLineItemIdentifier: string
) {
    const fullTermIdentifiers = (order.lineItems || [])
        .filter(hasFullTermDiscountApplied)
        .map((lineItem) => lineItem.metadata?.['lineItemIdentifier'] || '')

    return (
        fullTermIdentifiers.includes(cancelledLineItemIdentifier) &&
        fullTermIdentifiers.every(
            (identifier) => identifier === cancelledLineItemIdentifier || remainingLineItemIdentifiers.has(identifier)
        )
    )
}

/** Recalculates the original discount code against a new post-term-discount subtotal. */
function getRepricedDiscountCodeAmountCents(order: Square.Order, discountedSubtotalCents: number) {
    const discountCodeType = order.metadata?.['discountCodeType']
    const discountCodeAmount = Number.parseFloat(order.metadata?.['discountCodeAmount'] || '')

    if (!discountCodeType || Number.isNaN(discountCodeAmount)) return 0

    if (discountCodeType === 'percentage') {
        return roundPercentageCents(discountedSubtotalCents, discountCodeAmount)
    }

    return Math.min(Math.round(discountCodeAmount * 100), discountedSubtotalCents)
}

/** Reports whether a Square line item received the preschool full-term discount. */
function hasFullTermDiscountApplied(lineItem: Square.OrderLineItem) {
    return lineItem.appliedDiscounts?.some((discount) => discount.discountUid === FULL_TERM_DISCOUNT_UID) ?? false
}

/** Returns a Square line item's undiscounted base amount as a JavaScript number of cents. */
function getLineItemBaseAmountCents(lineItem: Square.OrderLineItem) {
    return Number(lineItem.basePriceMoney?.amount ?? BigInt(0))
}

/** Applies percentage rounding to cents consistently with checkout calculations. */
function roundPercentageCents(amountCents: number, percentage: number) {
    return Math.round(amountCents * (percentage / 100))
}
