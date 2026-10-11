import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PartyForm } from '@fizz-kidz/core'

import { submitPartyForm } from '../submit-party-form'

const mocks = vi.hoisted(() => ({ pay: vi.fn(), process: vi.fn(), validate: vi.fn() }))
vi.mock('@/features/payments/core/pay-checkout', () => ({ payCheckout: mocks.pay }))
vi.mock('../../booking/process-party-form', () => ({ processPartyFormSubmission: mocks.process }))
vi.mock('../validate-party-form', () => ({ validatePartyForm: mocks.validate }))
vi.mock('../prepare-party-form', () => ({ getCheckoutMetadata: () => ({ answersHash: 'answers' }) }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))

const payload: PartyForm = { mode: 'cake', bookingId: 'booking', takeHomeBags: { lollyBags: 12 }, products: {} }
const paid = { payload, checkoutId: 'square-order', token: 'card-token', buyerVerificationToken: '' }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.pay.mockResolvedValue({ status: 'paid', receiptUrl: 'https://receipt.example.com' })
    mocks.process.mockResolvedValue(undefined)
    mocks.validate.mockResolvedValue({ lineItems: [] })
})

describe('submitting the party form', () => {
    it('pays for the answers the checkout was prepared with, then applies them under the order id', async () => {
        expect(await submitPartyForm(paid)).toEqual({
            status: 'completed',
            receiptUrl: 'https://receipt.example.com',
        })
        expect(mocks.pay).toHaveBeenCalledWith({
            checkoutId: 'square-order',
            token: 'card-token',
            buyerVerificationToken: '',
            metadata: { answersHash: 'answers' },
        })
        expect(mocks.process).toHaveBeenCalledWith('square-order', payload, 'square-order')
    })
    it('leaves an unclear payment for a replay without applying the answers', async () => {
        mocks.pay.mockResolvedValue({ status: 'processing' })
        expect(await submitPartyForm(paid)).toEqual({ status: 'processing' })
        expect(mocks.process).not.toHaveBeenCalled()
    })
    it('reports processing when paid answers fail to apply, so a replay retries them', async () => {
        mocks.process.mockRejectedValue(new Error('Firestore unavailable'))
        expect(await submitPartyForm(paid)).toEqual({ status: 'processing' })
    })
    it('validates and applies answers with nothing to pay, passing errors to the customer', async () => {
        const unpaid = { ...paid, checkoutId: null, token: '' }
        expect(await submitPartyForm(unpaid)).toEqual({ status: 'completed', receiptUrl: null })
        expect(mocks.pay).not.toHaveBeenCalled()
        expect(mocks.process).toHaveBeenCalledWith(expect.any(String), payload, null)
        mocks.process.mockRejectedValue(new Error('Firestore unavailable'))
        await expect(submitPartyForm(unpaid)).rejects.toThrow('Firestore unavailable')
        mocks.validate.mockResolvedValue({ lineItems: [{ quantity: '12' }] })
        await expect(submitPartyForm(unpaid)).rejects.toThrow('refresh the payment summary')
    })
})
