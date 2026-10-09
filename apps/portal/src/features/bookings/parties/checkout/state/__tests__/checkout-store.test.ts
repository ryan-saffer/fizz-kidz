// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import type { TerminalCheckoutServer } from '@features/terminal-checkout/state/terminal-checkout-store'

import {
    estimateCharge,
    getEstimateLines,
    useCheckoutStore,
    type CheckoutAnswers,
    type CheckoutConfig,
} from '../checkout-store'

const booking = { id: 'booking', location: 'balwyn' } as WithId<FirestoreBooking>
const config = {
    blocked: null,
    payment: null,
    customerEmail: 'jane@example.com',
    minChildren: 12,
    bookedChildren: '12 - 15',
    partyPrices: [
        { partyLength: '1.5', includesFood: true, name: '1.5 Hour Party', priceCents: 4700, imageUrl: null },
        { partyLength: '2', includesFood: false, name: '2 Hour Party', priceCents: 5300, imageUrl: null },
    ],
    additions: [
        { key: 'fairyBread', name: 'Fairy Bread', description: null, imageUrl: null, priceCents: 3000 },
        { key: 'wedges', name: 'Wedges', description: null, imageUrl: null, priceCents: 3000 },
    ],
    prefill: { partyLength: '1.5', includesFood: true, childrenCount: 14, additions: ['fairyBread'] },
} as CheckoutConfig
const store = () => useCheckoutStore.getState()

afterEach(() => store().close())

describe('the party checkout', () => {
    it('starts from the booking and estimates the charge from Square prices', () => {
        store().open(booking)
        store().init({ config, answers: config.prefill, server: {} as TerminalCheckoutServer<CheckoutAnswers> })
        expect(store().steps.map((step) => step.key)).toEqual(['party', 'food', 'review'])
        expect(store().answers).toMatchObject({ partyLength: '1.5', childrenCount: 14, additions: ['fairyBread'] })
        expect(estimateCharge(config, store().answers).totalCents).toBe(14 * 4700 + 3000)
        expect(estimateCharge(config, { ...store().answers, childrenCount: 8 }).chargedChildren).toBe(12)
        expect(getEstimateLines(config, store().answers)).toEqual([
            { key: 'party', label: '14 × 1.5 Hour Party', detail: '$47.00 per child', amountCents: 14 * 4700 },
            { key: 'fairyBread', label: 'Fairy Bread', amountCents: 3000 },
        ])
    })

    it('keeps a charge on the terminal per booking', () => {
        localStorage.setItem(
            'party-checkout-charge:booking',
            JSON.stringify({ checkoutId: 'order', terminalCheckoutId: 'terminal' })
        )
        const status = vi.fn(() => new Promise(() => {}))
        store().open(booking)
        store().init({ config, server: { status } as unknown as TerminalCheckoutServer<CheckoutAnswers> })
        expect(store()).toMatchObject({ stage: 'charging', onTerminal: { checkoutId: 'order' } })
        expect(status).toHaveBeenCalledWith({ checkoutId: 'order', terminalCheckoutId: 'terminal' })
        localStorage.clear()
    })
})
