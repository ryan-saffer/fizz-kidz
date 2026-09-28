import { createHmac } from 'crypto'

import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { handleTerminalCheckoutWebhook, TERMINAL_CHECKOUT_WEBHOOK_URL } from '../handle-terminal-checkout-webhook'

const mocks = vi.hoisted(() => ({ settleParty: vi.fn(), settleSale: vi.fn(), order: vi.fn(), logError: vi.fn() }))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/shared/runtime/is-using-emulator', () => ({ isUsingEmulator: () => false }))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => ({ orders: { get: mocks.order } }) },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const KEY = 'signature-key'
const event = (status: string, type = 'terminal.checkout.updated') => ({
    type,
    data: { object: { checkout: { id: 'terminal', order_id: 'order', reference_id: 'booking', status } } },
})
const settlers = { 'party-checkout': mocks.settleParty, pos: mocks.settleSale }
function send(body: unknown, { key = KEY, url = TERMINAL_CHECKOUT_WEBHOOK_URL } = {}) {
    const rawBody = JSON.stringify(body)
    const signature = createHmac('sha256', key)
        .update(url + rawBody)
        .digest('base64')
    return handleTerminalCheckoutWebhook({ rawBody, signature, body }, settlers)
}
const orderFor = (metadata: Record<string, string>) =>
    mocks.order.mockResolvedValue({ order: { id: 'order', metadata } })

beforeEach(() => {
    vi.clearAllMocks()
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = KEY
    orderFor({ program: 'party-checkout', bookingId: 'booking' })
    mocks.settleParty.mockResolvedValue({ status: 'paid', receiptUrl: null })
    mocks.settleSale.mockResolvedValue({ status: 'paid', receiptUrl: null })
})

describe('the terminal checkout webhook', () => {
    it('listens where the Square subscriptions were set up, at the dev domain', () => {
        expect(TERMINAL_CHECKOUT_WEBHOOK_URL).toBe('https://dev.fizzkidz.com.au/api/webhooks/party-checkout')
    })

    it('has the booking flow that started a finished checkout settle it', async () => {
        expect(await send(event('COMPLETED'))).toBe(200)
        expect(mocks.settleParty).toHaveBeenCalledWith({
            checkoutId: 'order',
            terminalCheckoutId: 'terminal',
            referenceId: 'booking',
            metadata: { program: 'party-checkout', bookingId: 'booking' },
        })
        expect(await send(event('CANCELED'))).toBe(200)
        expect(mocks.settleParty).toHaveBeenCalledTimes(2)

        orderFor({ program: 'pos', studio: 'balwyn' })
        expect(await send(event('COMPLETED'))).toBe(200)
        expect(mocks.settleSale).toHaveBeenCalledWith(
            expect.objectContaining({ metadata: expect.objectContaining({ studio: 'balwyn' }) })
        )
        expect(mocks.settleParty).toHaveBeenCalledTimes(2)
    })

    it("ignores terminal charges that aren't our checkouts", async () => {
        orderFor({})
        expect(await send(event('COMPLETED'))).toBe(200)
        expect(mocks.settleParty).not.toHaveBeenCalled()
        expect(mocks.settleSale).not.toHaveBeenCalled()
    })

    it('ignores events that are not from Square', async () => {
        expect(await send(event('COMPLETED'), { key: 'someone-else' })).toBe(403)
        expect(await send(event('COMPLETED'), { url: 'https://example.com/hook' })).toBe(403)
        expect(mocks.settleParty).not.toHaveBeenCalled()
    })

    it('ignores checkouts still in progress and other events', async () => {
        expect(await send(event('IN_PROGRESS'))).toBe(200)
        expect(await send(event('COMPLETED', 'terminal.refund.updated'))).toBe(200)
        expect(mocks.order).not.toHaveBeenCalled()
    })

    it('asks Square to retry only when a retry could help', async () => {
        mocks.settleParty.mockRejectedValueOnce(new TRPCError({ code: 'BAD_REQUEST', message: 'different booking' }))
        expect(await send(event('COMPLETED'))).toBe(200)
        mocks.settleParty.mockRejectedValueOnce(new Error('Square is down'))
        expect(await send(event('COMPLETED'))).toBe(500)
        mocks.order.mockRejectedValueOnce(new Error('Square is down'))
        expect(await send(event('COMPLETED'))).toBe(500)
        expect(mocks.logError).toHaveBeenCalledTimes(3)
    })

    it('refuses everything until the signature key is set', async () => {
        process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = ''
        expect(await send(event('COMPLETED'))).toBe(500)
        expect(mocks.settleParty).not.toHaveBeenCalled()
    })
})
