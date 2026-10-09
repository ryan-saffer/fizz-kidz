import { strictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import { calculateRefundCents, isFullTermDiscountRemoved, repriceRemainingOrder } from './preschool-program-v2-pricing'

import type { Square } from 'square'

function makeLineItem({
    id,
    amount,
    isFullTermDiscount,
}: {
    id: string
    amount: number
    isFullTermDiscount: boolean
}): Square.OrderLineItem {
    return {
        uid: id,
        name: `Line ${id}`,
        quantity: '1',
        basePriceMoney: { amount: BigInt(amount), currency: 'AUD' },
        metadata: { lineItemIdentifier: id },
        appliedDiscounts: isFullTermDiscount ? [{ discountUid: 'full-term-discount' }] : undefined,
    } as Square.OrderLineItem
}

function makeOrder(lineItems: Square.OrderLineItem[], metadata: Record<string, string> = {}): Square.Order {
    return {
        id: 'order-1',
        lineItems,
        metadata,
    } as Square.Order
}

describe('processPreschoolProgramV2Refund pricing helpers', () => {
    it('reprices remaining classes at full price when one full-term session is cancelled', () => {
        const order = makeOrder(
            Array.from({ length: 8 }, (_, index) =>
                makeLineItem({ id: `line-${index + 1}`, amount: 4000, isFullTermDiscount: true })
            )
        )
        const remainingLineItemIdentifiers = new Set(Array.from({ length: 7 }, (_, index) => `line-${index + 1}`))

        strictEqual(repriceRemainingOrder(order, remainingLineItemIdentifiers), BigInt(28000))
        strictEqual(calculateRefundCents(BigInt(25600), BigInt(28000)), BigInt(0))
    })

    it('allows a refund after enough full-term sessions have been cancelled', () => {
        const order = makeOrder(
            Array.from({ length: 8 }, (_, index) =>
                makeLineItem({ id: `line-${index + 1}`, amount: 4000, isFullTermDiscount: true })
            )
        )
        const remainingLineItemIdentifiers = new Set(Array.from({ length: 6 }, (_, index) => `line-${index + 1}`))
        const repricedRemainingTotal = repriceRemainingOrder(order, remainingLineItemIdentifiers)

        strictEqual(repricedRemainingTotal, BigInt(24000))
        strictEqual(calculateRefundCents(BigInt(25600), repricedRemainingTotal), BigInt(1600))
    })

    it('keeps full-term discount when cancelling an ad-hoc session outside the term', () => {
        const order = makeOrder(
            [
                makeLineItem({ id: 'term-1', amount: 5400, isFullTermDiscount: true }),
                makeLineItem({ id: 'term-2', amount: 5400, isFullTermDiscount: true }),
                makeLineItem({ id: 'term-3', amount: 5400, isFullTermDiscount: true }),
                makeLineItem({ id: 'ad-hoc-1', amount: 5400, isFullTermDiscount: false }),
                makeLineItem({ id: 'ad-hoc-2', amount: 5400, isFullTermDiscount: false }),
            ],
            {
                discountCode: '10',
                discountCodeType: 'percentage',
                discountCodeAmount: '10',
            }
        )
        const remainingLineItemIdentifiers = new Set(['term-1', 'term-2', 'term-3', 'ad-hoc-1'])

        strictEqual(repriceRemainingOrder(order, remainingLineItemIdentifiers), BigInt(16524))
        strictEqual(calculateRefundCents(BigInt(21384), BigInt(16524)), BigInt(4860))
    })

    it('claws back full-term discount when cancelling a discounted term session', () => {
        const order = makeOrder(
            [
                makeLineItem({ id: 'term-1', amount: 5400, isFullTermDiscount: true }),
                makeLineItem({ id: 'term-2', amount: 5400, isFullTermDiscount: true }),
                makeLineItem({ id: 'term-3', amount: 5400, isFullTermDiscount: true }),
                makeLineItem({ id: 'ad-hoc-1', amount: 5400, isFullTermDiscount: false }),
                makeLineItem({ id: 'ad-hoc-2', amount: 5400, isFullTermDiscount: false }),
            ],
            {
                discountCode: '10',
                discountCodeType: 'percentage',
                discountCodeAmount: '10',
            }
        )
        const remainingLineItemIdentifiers = new Set(['term-1', 'term-2', 'ad-hoc-1', 'ad-hoc-2'])

        strictEqual(repriceRemainingOrder(order, remainingLineItemIdentifiers), BigInt(19440))
        strictEqual(calculateRefundCents(BigInt(21384), BigInt(19440)), BigInt(1944))
    })

    it('reports when a cancellation removes the full-term discount', () => {
        const order = makeOrder([
            makeLineItem({ id: 'term-1', amount: 3900, isFullTermDiscount: true }),
            makeLineItem({ id: 'term-2', amount: 3900, isFullTermDiscount: true }),
            makeLineItem({ id: 'ad-hoc-1', amount: 3900, isFullTermDiscount: false }),
        ])

        strictEqual(isFullTermDiscountRemoved(order, new Set(['term-2', 'ad-hoc-1']), 'term-1'), true)
        // already removed by an earlier cancellation
        strictEqual(isFullTermDiscountRemoved(order, new Set(['ad-hoc-1']), 'term-1'), false)
        strictEqual(isFullTermDiscountRemoved(order, new Set(['term-1', 'term-2']), 'ad-hoc-1'), false)
    })
})
