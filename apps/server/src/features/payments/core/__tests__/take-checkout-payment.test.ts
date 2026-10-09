import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { takeCheckoutPayment } from '../take-checkout-payment'

import type { CheckoutMetadata } from '../checkout-order'

const square = vi.hoisted(() => ({
    orders: { pay: vi.fn() },
    payments: { create: vi.fn(), cancel: vi.fn(), get: vi.fn() },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => square },
    getSquareError: async (error: { statusCode?: number }) => (error.statusCode ? error : undefined),
}))

const tokens = { token: 'card-token', buyerVerificationToken: 'verification' }
const order = (totalCents: number) => ({
    id: 'order',
    locationId: 'location',
    state: 'OPEN' as const,
    totalMoney: { currency: 'AUD' as const, amount: BigInt(totalCents) },
})
const checkout = (giftCardCents = 0): CheckoutMetadata => ({
    program: 'party-form',
    customerEmail: 'parent@example.com',
    customerName: 'Parent Test',
    discountCode: '',
    discountCodeId: '',
    giftCardId: giftCardCents ? 'gift' : '',
    giftCardCents,
})

beforeEach(() => {
    vi.clearAllMocks()
    square.payments.create.mockImplementation(async ({ sourceId }) => ({
        payment: { id: sourceId, status: 'APPROVED' },
    }))
    square.orders.pay.mockResolvedValue({})
    square.payments.cancel.mockResolvedValue({})
    square.payments.get.mockResolvedValue({
        payment: { status: 'APPROVED', receiptUrl: 'https://receipt.example.com' },
    })
})

describe('taking a checkout payment', () => {
    it('authorises a partial gift card and the exact card remainder before paying the order', async () => {
        expect(await takeCheckoutPayment(order(1000), checkout(300), tokens)).toBe('https://receipt.example.com')
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
            idempotencyKey: 'order-pay',
        })
    })
    it('sends no verification token for wallet payments', async () => {
        await takeCheckoutPayment(order(1000), checkout(), { token: 'wallet-token', buyerVerificationToken: '' })
        expect(square.payments.create.mock.calls[0][0].verificationToken).toBeUndefined()
    })
    it('pays a gift-card-only order without a card payment', async () => {
        await takeCheckoutPayment(order(1000), checkout(1000), { token: '', buyerVerificationToken: '' })
        expect(square.payments.create).toHaveBeenCalledTimes(1)
        expect(square.orders.pay).toHaveBeenCalledWith(expect.objectContaining({ paymentIds: ['gift'] }))
    })
    it('completes a fully discounted order with no payments', async () => {
        await takeCheckoutPayment(order(0), checkout(), { token: '', buyerVerificationToken: '' })
        expect(square.payments.create).not.toHaveBeenCalled()
        expect(square.orders.pay).toHaveBeenCalledWith(expect.objectContaining({ paymentIds: [] }))
    })
    it('releases the gift-card authorisation when the card is declined', async () => {
        square.payments.create
            .mockResolvedValueOnce({ payment: { id: 'gift-payment', status: 'APPROVED' } })
            .mockRejectedValueOnce({ statusCode: 400, errors: [{ category: 'PAYMENT_METHOD_ERROR' }] })
        await expect(takeCheckoutPayment(order(1000), checkout(300), tokens)).rejects.toThrow('Payment failed')
        expect(square.payments.cancel).toHaveBeenCalledWith({ paymentId: 'gift-payment' })
        expect(square.orders.pay).not.toHaveBeenCalled()
    })
    it('keeps authorisations after an unclear error so the same request can be replayed with the same keys', async () => {
        square.payments.create
            .mockResolvedValueOnce({ payment: { id: 'gift-payment', status: 'APPROVED' } })
            .mockRejectedValueOnce(new Error('Connection closed'))
        await expect(takeCheckoutPayment(order(1000), checkout(300), tokens)).rejects.toThrow('Connection closed')
        expect(square.payments.cancel).not.toHaveBeenCalled()
        await takeCheckoutPayment(order(1000), checkout(300), tokens)
        const keys = square.payments.create.mock.calls.map(([request]) => request.idempotencyKey)
        expect(keys).toEqual(['order-gift', 'order-card', 'order-gift', 'order-card'])
    })
    it('treats a 4xx paying the order as definite, releasing both authorisations', async () => {
        square.orders.pay.mockRejectedValueOnce({ statusCode: 400, errors: [{ code: 'INVALID_REQUEST' }] })
        await expect(takeCheckoutPayment(order(1000), checkout(300), tokens)).rejects.toThrow('refresh the payment')
        expect(square.payments.cancel).toHaveBeenCalledWith({ paymentId: 'gift' })
        expect(square.payments.cancel).toHaveBeenCalledWith({ paymentId: 'card-token' })
    })
    it('keeps authorisations after a Square 5xx, which is unclear', async () => {
        square.orders.pay.mockRejectedValueOnce({ statusCode: 503, errors: [] })
        await expect(takeCheckoutPayment(order(1000), checkout(300), tokens)).rejects.toMatchObject({ statusCode: 503 })
        expect(square.payments.cancel).not.toHaveBeenCalled()
    })
})
