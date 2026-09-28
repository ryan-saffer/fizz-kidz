import { describe, expect, it } from 'vite-plus/test'

import { getTerminalCheckoutStudios } from '@fizz-kidz/core'

import { getEstimateLines, MAX_QUANTITY, setQuantity } from '../pos-store'

const products = [
    { variationId: 'slime', name: 'String Slime Kit', description: null, imageUrl: null, priceCents: 1995 },
    { variationId: 'soap', name: 'Soap Making Kit', description: null, imageUrl: null, priceCents: 1995 },
]

describe('a product sale', () => {
    it('adds, changes and removes products, keeping their order', () => {
        let items = setQuantity([], 'slime', 1)
        items = setQuantity(items, 'soap', 2)
        items = setQuantity(items, 'slime', 3)
        expect(items).toEqual([
            { variationId: 'slime', quantity: 3 },
            { variationId: 'soap', quantity: 2 },
        ])
        expect(setQuantity(items, 'slime', 0)).toEqual([{ variationId: 'soap', quantity: 2 }])
        expect(setQuantity(items, 'soap', 500)).toContainEqual({ variationId: 'soap', quantity: MAX_QUANTITY })
    })

    it("estimates the sale from Square's prices", () => {
        const items = [
            { variationId: 'slime', quantity: 2 },
            { variationId: 'soap', quantity: 1 },
            { variationId: 'no-longer-sold', quantity: 1 },
        ]
        expect(
            getEstimateLines({ products }, { items, discountCents: 0, discountReason: '', giftCardNumber: '' })
        ).toEqual([
            { key: 'slime', label: '2 × String Slime Kit', detail: '$19.95 each', amountCents: 3990 },
            { key: 'soap', label: '1 × Soap Making Kit', detail: undefined, amountCents: 1995 },
        ])
    })

    it("sells at a studio iPad's own studio, or any studio for head office, once it has terminal checkout", () => {
        expect(getTerminalCheckoutStudios('balwyn', 'dev')).toEqual(['balwyn'])
        expect(getTerminalCheckoutStudios('master', 'dev')).toHaveLength(7)
        expect(getTerminalCheckoutStudios(null, 'dev')).toEqual([])
        // no studios are trialling it yet
        expect(getTerminalCheckoutStudios('balwyn', 'prod')).toEqual([])
        expect(getTerminalCheckoutStudios('master', 'prod')).toEqual([])
        // super-admins always can, to try it out
        expect(getTerminalCheckoutStudios('master', 'prod', true)).toHaveLength(7)
        expect(getTerminalCheckoutStudios('balwyn', 'prod', true)).toEqual(['balwyn'])
    })
})
