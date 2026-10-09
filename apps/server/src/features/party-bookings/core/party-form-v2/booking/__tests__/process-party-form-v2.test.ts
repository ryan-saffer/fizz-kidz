import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PartyFormV2 } from '@fizz-kidz/core'

import { processPartyFormV2Submission } from '../process-party-form-v2'

const mocks = vi.hoisted(() => ({
    getSubmission: vi.fn(),
    createSubmission: vi.fn(),
    markApplied: vi.fn(),
    getBooking: vi.fn(),
    handle: vi.fn(),
    inventory: vi.fn(),
    logError: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: {
        getPartyFormSubmission: mocks.getSubmission,
        createPartyFormSubmission: mocks.createSubmission,
        markPartyFormSubmissionApplied: mocks.markApplied,
        getPartyBooking: mocks.getBooking,
    },
}))
vi.mock('@/features/party-bookings/core/handle-party-form-submission', () => ({
    handlePartyFormSubmission: mocks.handle,
}))
vi.mock('../../build-party-form-v2-submission', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    buildPartyFormV2Submission: () => 'responses',
}))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => ({ inventory: { batchCreateChanges: mocks.inventory } }) },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const payload: PartyFormV2 = { mode: 'cake', bookingId: 'booking', takeHomeBags: { lollyBags: 12 }, products: {} }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSubmission.mockResolvedValue(undefined)
    mocks.getBooking.mockResolvedValue({ location: 'malvern' })
})

describe('processing a party form submission', () => {
    it('saves the submission, puts the goodies stock back, applies it to the booking and marks it applied', async () => {
        await processPartyFormV2Submission('square-order', payload, 'square-order')
        expect(mocks.createSubmission).toHaveBeenCalledWith(
            'square-order',
            expect.objectContaining({
                bookingId: 'booking',
                payload,
                checkoutId: 'square-order',
                bookingApplied: false,
            })
        )
        expect(mocks.inventory).toHaveBeenCalledWith(
            expect.objectContaining({ idempotencyKey: 'square-order-inventory' })
        )
        expect(mocks.handle).toHaveBeenCalledWith('responses', undefined)
        expect(mocks.markApplied).toHaveBeenCalledWith('square-order')
    })
    it('retries a saved submission that was not applied, and does nothing once it was', async () => {
        mocks.getSubmission.mockResolvedValue({ bookingApplied: false })
        await processPartyFormV2Submission('square-order', payload, 'square-order')
        expect(mocks.createSubmission).not.toHaveBeenCalled()
        expect(mocks.handle).toHaveBeenCalledOnce()

        vi.clearAllMocks()
        mocks.getSubmission.mockResolvedValue({ bookingApplied: true })
        await processPartyFormV2Submission('square-order', payload, 'square-order')
        expect(mocks.handle).not.toHaveBeenCalled()
        expect(mocks.markApplied).not.toHaveBeenCalled()
    })
    it('logs a second cake paid for since the checkout was prepared, but not a replay of its own cake', async () => {
        const cake = {
            selection: 'Rainbow Ice-Cream Cake',
            size: 'Small (12-15 serves)',
            flavours: ['Vanilla'],
            served: 'Waffle Cones',
            candles: 'Include candles',
        }
        mocks.getBooking.mockResolvedValue({ location: 'malvern', cake })
        await processPartyFormV2Submission('square-order', { ...payload, cake }, 'square-order')
        expect(mocks.logError).not.toHaveBeenCalled()

        mocks.getBooking.mockResolvedValue({
            location: 'malvern',
            cake: { ...cake, selection: 'Unicorn Ice-Cream Cake' },
        })
        await processPartyFormV2Submission('square-order', { ...payload, cake }, 'square-order')
        expect(mocks.logError).toHaveBeenCalledWith(
            expect.stringContaining('second cake'),
            undefined,
            expect.objectContaining({ previousCake: 'Unicorn Ice-Cream Cake', newCake: 'Rainbow Ice-Cream Cake' })
        )
        expect(mocks.handle).toHaveBeenLastCalledWith('responses', cake)
    })
    it('still applies the booking when Square inventory is unavailable', async () => {
        mocks.inventory.mockRejectedValue(new Error('Square unavailable'))
        await processPartyFormV2Submission('square-order', payload, 'square-order')
        expect(mocks.markApplied).toHaveBeenCalled()
    })
})
