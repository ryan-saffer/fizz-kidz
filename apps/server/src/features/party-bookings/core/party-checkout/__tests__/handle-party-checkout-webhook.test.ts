import { createHmac } from 'crypto'

import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { handlePartyCheckoutWebhook, PARTY_CHECKOUT_WEBHOOK_URL } from '../handle-party-checkout-webhook'

const mocks = vi.hoisted(() => ({ getStatus: vi.fn(), logError: vi.fn() }))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/shared/runtime/is-using-emulator', () => ({ isUsingEmulator: () => false }))
vi.mock('../charge-party-checkout', () => ({ getPartyCheckoutStatus: mocks.getStatus }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const KEY = 'signature-key'
const event = (status: string, type = 'terminal.checkout.updated') => ({
    type,
    data: { object: { checkout: { id: 'terminal', order_id: 'order', reference_id: 'booking', status } } },
})
function send(body: unknown, { key = KEY, url = PARTY_CHECKOUT_WEBHOOK_URL } = {}) {
    const rawBody = JSON.stringify(body)
    const signature = createHmac('sha256', key)
        .update(url + rawBody)
        .digest('base64')
    return handlePartyCheckoutWebhook({ rawBody, signature, body })
}

beforeEach(() => {
    vi.clearAllMocks()
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = KEY
    mocks.getStatus.mockResolvedValue({ status: 'paid', receiptUrl: null })
})

describe('the party checkout webhook', () => {
    it('listens at the dev domain', () => {
        expect(PARTY_CHECKOUT_WEBHOOK_URL).toBe('https://dev.fizzkidz.com.au/api/webhooks/party-checkout')
    })

    it('settles a finished terminal checkout just as the iPad would', async () => {
        expect(await send(event('COMPLETED'))).toBe(200)
        expect(mocks.getStatus).toHaveBeenCalledWith({
            bookingId: 'booking',
            checkoutId: 'order',
            terminalCheckoutId: 'terminal',
        })
        expect(await send(event('CANCELED'))).toBe(200)
        expect(mocks.getStatus).toHaveBeenCalledTimes(2)
    })

    it('ignores events that are not from Square', async () => {
        expect(await send(event('COMPLETED'), { key: 'someone-else' })).toBe(403)
        expect(await send(event('COMPLETED'), { url: 'https://example.com/hook' })).toBe(403)
        expect(mocks.getStatus).not.toHaveBeenCalled()
    })

    it('ignores checkouts still in progress and other events', async () => {
        expect(await send(event('IN_PROGRESS'))).toBe(200)
        expect(await send(event('COMPLETED', 'terminal.refund.updated'))).toBe(200)
        expect(mocks.getStatus).not.toHaveBeenCalled()
    })

    it('asks Square to retry only when a retry could help', async () => {
        mocks.getStatus.mockRejectedValueOnce(new TRPCError({ code: 'BAD_REQUEST', message: 'different booking' }))
        expect(await send(event('COMPLETED'))).toBe(200)
        mocks.getStatus.mockRejectedValueOnce(new Error('Square is down'))
        expect(await send(event('COMPLETED'))).toBe(500)
        expect(mocks.logError).toHaveBeenCalledTimes(2)
    })

    it('refuses everything until the signature key is set', async () => {
        process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = ''
        expect(await send(event('COMPLETED'))).toBe(500)
        expect(mocks.getStatus).not.toHaveBeenCalled()
    })
})
