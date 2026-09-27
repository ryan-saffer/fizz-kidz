// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import { saveCharge } from '../checkout-storage'
import { estimateCharge, useCheckoutStore, type CheckoutConfig, type CheckoutServer } from '../checkout-store'

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
const summary = (cardCents = 69800) => ({
    checkoutId: 'order',
    locationId: 'location',
    customerEmail: 'jane@example.com',
    subtotalCents: 69800,
    discountCents: 0,
    discountCode: '',
    orderDiscountCents: 0,
    totalCents: 69800,
    giftCardCents: 69800 - cardCents,
    giftCardLast4: '',
    cardCents,
    items: [],
})
const terminal = { deviceId: 'device', name: 'Front desk' }

let server: { [K in keyof CheckoutServer]: ReturnType<typeof vi.fn> }
const store = () => useCheckoutStore.getState()

function openCheckout() {
    store().open(booking)
    store().init({ config, server: server as unknown as CheckoutServer })
    store().setTerminals([terminal])
}

beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    server = {
        prepare: vi.fn().mockResolvedValue(summary()),
        start: vi.fn().mockResolvedValue({ status: 'waiting', terminalCheckoutId: 'terminal' }),
        status: vi.fn().mockResolvedValue({ status: 'waiting', terminalCheckoutId: 'terminal' }),
        cancel: vi.fn().mockResolvedValue(null),
    }
})

afterEach(() => {
    store().close()
    vi.useRealTimers()
})

describe('the party checkout', () => {
    it('starts from the booking and estimates the charge from Square prices', () => {
        openCheckout()
        expect(store().answers).toMatchObject({ partyLength: '1.5', childrenCount: 14, additions: ['fairyBread'] })
        expect(estimateCharge(config, store().answers).totalCents).toBe(14 * 4700 + 3000)
        expect(estimateCharge(config, { ...store().answers, childrenCount: 8 }).chargedChildren).toBe(12)
    })

    it('asks Square for the price on the review step, and again whenever an answer changes there', async () => {
        openCheckout()
        store().goTo('food')
        expect(server.prepare).not.toHaveBeenCalled()

        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        expect(server.prepare).toHaveBeenCalledWith(
            expect.objectContaining({ bookingId: 'booking', childrenCount: 14 })
        )

        store().setAnswers({ discountCents: 2000 })
        expect(store().summary).toBeNull()
        await vi.waitFor(() => expect(server.prepare).toHaveBeenCalledTimes(2))
        expect(server.prepare).toHaveBeenLastCalledWith(expect.objectContaining({ discountCents: 2000 }))
    })

    it('charges the terminal and waits until the customer pays', async () => {
        openCheckout()
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())

        await store().charge()
        expect(server.start).toHaveBeenCalledWith({ bookingId: 'booking', checkoutId: 'order', deviceId: 'device' })
        expect(store().stage).toBe('charging')
        expect(localStorage.getItem('party-checkout-charge:booking')).not.toBeNull()

        server.status.mockResolvedValue({ status: 'paid', receiptUrl: 'https://receipt' })
        await vi.advanceTimersByTimeAsync(2000)
        expect(store()).toMatchObject({ stage: 'paid', receiptUrl: 'https://receipt' })
        expect(localStorage.getItem('party-checkout-charge:booking')).toBeNull()
    })

    it('shows why a charge was cancelled, then sends a fresh one', async () => {
        openCheckout()
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        server.status.mockResolvedValue({ status: 'canceled', reason: 'The customer cancelled.' })
        await store().charge()
        await vi.waitFor(() => expect(store().stage).toBe('canceled'))
        expect(store().error).toBe('The customer cancelled.')

        server.status.mockResolvedValue({ status: 'waiting', terminalCheckoutId: 'terminal-2' })
        server.start.mockResolvedValue({ status: 'waiting', terminalCheckoutId: 'terminal-2' })
        await store().resend()
        expect(server.prepare).toHaveBeenCalledTimes(2)
        expect(server.start).toHaveBeenCalledTimes(2)
        expect(store().stage).toBe('charging')
    })

    it('asks the terminal to cancel, and keeps checking how the charge ended', async () => {
        openCheckout()
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        await store().charge()

        await store().cancel()
        expect(server.cancel).toHaveBeenCalledWith({
            bookingId: 'booking',
            checkoutId: 'order',
            terminalCheckoutId: 'terminal',
        })
        expect(store().stage).toBe('charging')
    })

    it('finishes straight away when a gift card covers everything', async () => {
        server.prepare.mockResolvedValue(summary(0))
        server.start.mockResolvedValue({ status: 'paid', receiptUrl: null })
        openCheckout()
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        await store().charge()
        expect(store().stage).toBe('paid')
        expect(server.status).not.toHaveBeenCalled()
    })

    it('picks up a charge this iPad left on the terminal', async () => {
        saveCharge('booking', { checkoutId: 'order', terminalCheckoutId: 'terminal' })
        openCheckout()
        expect(store().stage).toBe('charging')
        await vi.waitFor(() =>
            expect(server.status).toHaveBeenCalledWith({
                bookingId: 'booking',
                checkoutId: 'order',
                terminalCheckoutId: 'terminal',
            })
        )
    })

    it('stops checking a charge the server keeps failing to check, and says it may have been paid', async () => {
        openCheckout()
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        await store().charge()

        server.status.mockRejectedValue({ message: 'Square is down', data: { code: 'INTERNAL_SERVER_ERROR' } })
        await vi.advanceTimersByTimeAsync(2000 * 6)
        expect(store()).toMatchObject({ stage: 'canceled', unclear: true })
        expect(store().error).toContain('Square is down')
        expect(localStorage.getItem('party-checkout-charge:booking')).toBeNull()
    })

    it('keeps checking through a dropped connection', async () => {
        openCheckout()
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        await store().charge()

        server.status.mockRejectedValue(new TypeError('Failed to fetch'))
        await vi.advanceTimersByTimeAsync(2000 * 10)
        expect(store().stage).toBe('charging')
    })

    it('sends the same charge again when it may have reached the terminal', async () => {
        openCheckout()
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        server.start.mockRejectedValueOnce(new TypeError('Failed to fetch'))
        await store().charge()
        expect(store()).toMatchObject({ stage: 'editing', step: 'review' })
        expect(store().summary).not.toBeNull()

        await store().charge()
        expect(server.start).toHaveBeenLastCalledWith(expect.objectContaining({ checkoutId: 'order' }))
        expect(server.prepare).toHaveBeenCalledTimes(1)
        expect(store().stage).toBe('charging')
    })

    it('offers to send a fresh charge when the server refuses one', async () => {
        openCheckout()
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        server.start.mockRejectedValueOnce({
            message: 'The gift card could not be charged.',
            data: { code: 'BAD_REQUEST' },
        })
        await store().charge()
        expect(store()).toMatchObject({
            stage: 'canceled',
            error: 'The gift card could not be charged.',
            unclear: false,
        })

        store().edit()
        expect(store()).toMatchObject({ stage: 'editing', step: 'party', summary: null })
    })

    it("charges the studio's terminal, or asks which when there's more than one", () => {
        const sandbox = [terminal, { deviceId: 'cancels', name: 'Sandbox: customer cancels' }]
        store().open(booking)
        store().init({ config, server: server as unknown as CheckoutServer })

        store().setTerminals([terminal])
        expect(store().terminal).toEqual(terminal)

        store().setTerminals(sandbox)
        expect(store().terminal).toEqual(terminal)
        store().setTerminal(sandbox[1])
        store().setTerminals([...sandbox])
        expect(store().terminal).toEqual(sandbox[1])

        store().open(booking)
        store().setTerminals(sandbox)
        expect(store().terminal).toBeNull()
    })

    it("can't charge without a terminal", async () => {
        store().open(booking)
        store().init({ config, server: server as unknown as CheckoutServer })
        store().setTerminals([])
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        await store().charge()
        expect(server.start).not.toHaveBeenCalled()
    })
})
