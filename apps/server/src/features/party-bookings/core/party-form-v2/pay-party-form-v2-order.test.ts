import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { payPartyFormV2Order } from './pay-party-form-v2-order'

import type { PartyFormV2PaymentRecord } from '@/integrations/firebase/firestore.refs'

const square = vi.hoisted(() => ({
    orders: { get: vi.fn(), pay: vi.fn() },
    payments: { create: vi.fn(), cancel: vi.fn(), get: vi.fn() },
}))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => square },
    getSquareError: async (error: { errors?: unknown[] }) => (error.errors ? error : undefined),
}))

const input = {
    submissionId: '2b323edb-756e-490b-a48e-2a5f6c16d6a0',
    token: 'card-token',
    buyerVerificationToken: 'verification',
}
function record(totalCents: number, giftCardCents = 0): PartyFormV2PaymentRecord {
    return {
        orderId: 'order',
        giftCardId: giftCardCents ? 'gift' : '',
        discount: null,
        state: 'ready',
        leaseUntil: 0,
        receiptUrl: null,
        createdAt: 0,
        summary: {
            submissionId: input.submissionId,
            locationId: 'location',
            parentEmail: 'parent@example.com',
            subtotalCents: totalCents,
            discountCents: 0,
            discountCode: '',
            totalCents,
            giftCardCents,
            giftCardLast4: '1234',
            cardCents: totalCents - giftCardCents,
            items: [],
        },
    }
}
beforeEach(() => {
    vi.clearAllMocks()
    square.orders.get.mockResolvedValue({
        order: { id: 'order', state: 'OPEN', locationId: 'location', totalMoney: { amount: 1000n } },
    })
    square.payments.create.mockImplementation(async ({ sourceId }) => ({
        payment: { id: sourceId, status: 'APPROVED', receiptUrl: 'https://receipt.example.com' },
    }))
    square.orders.pay.mockResolvedValue({})
    square.payments.cancel.mockResolvedValue({})
    square.payments.get.mockResolvedValue({
        payment: { status: 'APPROVED', receiptUrl: 'https://receipt.example.com' },
    })
})

describe('party form direct payments', () => {
    it('authorises a partial gift card and the exact card remainder before paying the order', async () => {
        await payPartyFormV2Order(input, record(1000, 300))
        expect(square.payments.create).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                sourceId: 'gift',
                amountMoney: { currency: 'AUD', amount: 300n },
                autocomplete: false,
            })
        )
        expect(square.payments.create).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                sourceId: 'card-token',
                amountMoney: { currency: 'AUD', amount: 700n },
                verificationToken: 'verification',
                autocomplete: false,
            })
        )
        expect(square.orders.pay).toHaveBeenCalledWith({
            orderId: 'order',
            paymentIds: ['gift', 'card-token'],
            idempotencyKey: `${input.submissionId}-pay`,
        })
    })
    it('pays a gift-card-only order without creating a credit-card payment', async () => {
        await payPartyFormV2Order({ ...input, token: '' }, record(1000, 1000))
        expect(square.payments.create).toHaveBeenCalledTimes(1)
        expect(square.orders.pay).toHaveBeenCalledWith(expect.objectContaining({ paymentIds: ['gift'] }))
    })
    it('completes a fully discounted order with no tenders', async () => {
        square.orders.get.mockResolvedValue({
            order: { state: 'OPEN', locationId: 'location', totalMoney: { amount: 0n } },
        })
        await payPartyFormV2Order({ ...input, token: '' }, record(0))
        expect(square.payments.create).not.toHaveBeenCalled()
        expect(square.orders.pay).toHaveBeenCalledWith(expect.objectContaining({ paymentIds: [] }))
    })
    it('releases the gift-card authorisation when the card is definitively declined', async () => {
        square.payments.create
            .mockResolvedValueOnce({ payment: { id: 'gift-payment', status: 'APPROVED' } })
            .mockRejectedValueOnce({ errors: [{ category: 'PAYMENT_METHOD_ERROR' }] })
        await expect(payPartyFormV2Order(input, record(1000, 300))).rejects.toThrow('Payment failed')
        expect(square.payments.cancel).toHaveBeenCalledWith({ paymentId: 'gift-payment' })
        expect(square.orders.pay).not.toHaveBeenCalled()
    })
    it('preserves authorisations on an ambiguous network error so the same request can be replayed', async () => {
        square.payments.create
            .mockResolvedValueOnce({ payment: { id: 'gift-payment', status: 'APPROVED' } })
            .mockRejectedValueOnce(new Error('Connection closed'))
        await expect(payPartyFormV2Order(input, record(1000, 300))).rejects.toThrow('Connection closed')
        expect(square.payments.cancel).not.toHaveBeenCalled()
        await payPartyFormV2Order(input, record(1000, 300))
        expect(square.payments.create.mock.calls[0][0].idempotencyKey).toBe(
            square.payments.create.mock.calls[2][0].idempotencyKey
        )
        expect(square.payments.create.mock.calls[1][0].idempotencyKey).toBe(
            square.payments.create.mock.calls[3][0].idempotencyKey
        )
    })
    it('does not charge a completed order again or accept a changed amount', async () => {
        square.orders.get.mockResolvedValueOnce({ order: { state: 'COMPLETED' } })
        await payPartyFormV2Order(input, record(1000))
        expect(square.payments.create).not.toHaveBeenCalled()
        await expect(payPartyFormV2Order(input, record(999))).rejects.toThrow('no longer available')
        expect(square.payments.create).not.toHaveBeenCalled()
    })

    it('recognises a cancelled gift authorisation after its cancellation response was lost', async () => {
        // Square may replay the cached APPROVED response for the idempotent create.
        square.payments.get.mockResolvedValueOnce({ payment: { status: 'CANCELED' } })
        await expect(payPartyFormV2Order(input, record(1000, 300))).rejects.toThrow('was cancelled')
        expect(square.payments.create).toHaveBeenCalledTimes(1)
        expect(square.orders.pay).not.toHaveBeenCalled()
    })

    it('releases a remaining gift authorisation when the card authorisation expired before order capture', async () => {
        square.payments.get
            .mockResolvedValueOnce({ payment: { status: 'APPROVED' } })
            .mockResolvedValueOnce({ payment: { status: 'CANCELED' } })
        await expect(payPartyFormV2Order(input, record(1000, 300))).rejects.toThrow('Payment failed')
        expect(square.payments.cancel).toHaveBeenCalledWith({ paymentId: 'gift' })
        expect(square.orders.pay).not.toHaveBeenCalled()
    })
})
