// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { saveCharge } from '../charge-storage'
import { createTerminalCheckoutStore, type TerminalCheckoutServer } from '../terminal-checkout-store'

type Answers = { items: string[]; discountCents: number; discountReason: string; giftCardNumber: string }

const useCheckoutStore = createTerminalCheckoutStore<{ id: string }, { products: string[] }, Answers>({
    storageKey: 'test-checkout-charge',
    getSubjectId: (subject) => subject.id,
    steps: [
        { key: 'items', label: 'Items' },
        { key: 'extras', label: 'Extras' },
    ],
    initialAnswers: { items: [], discountCents: 0, discountReason: '', giftCardNumber: '' },
})
const subject = { id: 'sale' }
const config = { products: ['slime'] }
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

let server: { [K in keyof TerminalCheckoutServer<Answers>]: ReturnType<typeof vi.fn> }
const store = () => useCheckoutStore.getState()

function openCheckout() {
    store().open(subject)
    store().init({
        config,
        server: server as unknown as TerminalCheckoutServer<Answers>,
        answers: { items: ['slime'] },
    })
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

describe('a terminal checkout', () => {
    it('starts from the answers it was given, with the review step last', () => {
        openCheckout()
        expect(store().answers).toEqual({ items: ['slime'], discountCents: 0, discountReason: '', giftCardNumber: '' })
        expect(store().steps.map((step) => step.key)).toEqual(['items', 'extras', 'review'])
        expect(store().step).toBe('items')
    })

    it('asks Square for the price on the review step, and again whenever an answer changes there', async () => {
        openCheckout()
        store().goTo('extras')
        expect(server.prepare).not.toHaveBeenCalled()

        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        expect(server.prepare).toHaveBeenCalledWith(expect.objectContaining({ items: ['slime'] }))

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
        expect(server.start).toHaveBeenCalledWith({ checkoutId: 'order', deviceId: 'device' })
        expect(store().stage).toBe('charging')
        expect(localStorage.getItem('test-checkout-charge:sale')).not.toBeNull()

        server.status.mockResolvedValue({ status: 'paid', receiptUrl: 'https://receipt' })
        await vi.advanceTimersByTimeAsync(2000)
        expect(store()).toMatchObject({ stage: 'paid', receiptUrl: 'https://receipt' })
        expect(localStorage.getItem('test-checkout-charge:sale')).toBeNull()
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
        expect(server.cancel).toHaveBeenCalledWith({ checkoutId: 'order', terminalCheckoutId: 'terminal' })
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
        saveCharge('test-checkout-charge:sale', { checkoutId: 'order', terminalCheckoutId: 'terminal' })
        openCheckout()
        expect(store().stage).toBe('charging')
        await vi.waitFor(() =>
            expect(server.status).toHaveBeenCalledWith({ checkoutId: 'order', terminalCheckoutId: 'terminal' })
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
        expect(localStorage.getItem('test-checkout-charge:sale')).toBeNull()
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
        expect(store()).toMatchObject({ stage: 'editing', step: 'items', summary: null })
    })

    it("charges the studio's terminal, or asks which when there's more than one", () => {
        const sandbox = [terminal, { deviceId: 'cancels', name: 'Sandbox: customer cancels' }]
        store().open(subject)
        store().init({ config, server: server as unknown as TerminalCheckoutServer<Answers> })

        store().setTerminals([terminal])
        expect(store().terminal).toEqual(terminal)

        store().setTerminals(sandbox)
        expect(store().terminal).toEqual(terminal)
        store().setTerminal(sandbox[1])
        store().setTerminals([...sandbox])
        expect(store().terminal).toEqual(sandbox[1])

        store().open(subject)
        store().setTerminals(sandbox)
        expect(store().terminal).toBeNull()
    })

    it("can't charge without a terminal", async () => {
        store().open(subject)
        store().init({ config, server: server as unknown as TerminalCheckoutServer<Answers> })
        store().setTerminals([])
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        await store().charge()
        expect(server.start).not.toHaveBeenCalled()
    })

    it('starts a fresh charge after a paid one, keeping the terminal', async () => {
        server.start.mockResolvedValue({ status: 'paid', receiptUrl: null })
        openCheckout()
        store().setAnswers({ items: ['slime', 'soap'] })
        store().goTo('review')
        await vi.waitFor(() => expect(store().summary).not.toBeNull())
        store().startOver()
        expect(store().step).toBe('review')

        await store().charge()
        store().startOver()
        expect(store()).toMatchObject({ stage: 'editing', step: 'items', summary: null, subject, terminal })
        expect(store().answers.items).toEqual([])
    })
})
