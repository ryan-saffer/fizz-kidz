import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { payCheckout } from '../pay-checkout'

const mocks = vi.hoisted(() => ({
    getOrder: vi.fn(),
    take: vi.fn(),
    receipt: vi.fn(),
    checkDiscount: vi.fn(),
    findDiscount: vi.fn(),
    hasRedemption: vi.fn(),
    createRedemption: vi.fn(),
    updateDiscount: vi.fn(),
}))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => ({ orders: { get: mocks.getOrder } }) },
}))
vi.mock('../take-checkout-payment', () => ({ takeCheckoutPayment: mocks.take, getReceiptUrl: mocks.receipt }))
vi.mock('@/features/discount-codes/core/check-discount-code', () => ({
    checkDiscountCode: mocks.checkDiscount,
    getDiscountCodeRedemptionKey: (code: string, email: string) => `${code}:${email}`,
}))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: {
        checkDiscountCode: mocks.findDiscount,
        hasDiscountCodeRedemption: mocks.hasRedemption,
        createDiscountCodeRedemption: mocks.createRedemption,
        updateDiscountCode: mocks.updateDiscount,
    },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))

const input = { checkoutId: 'order', token: 'card-token', buyerVerificationToken: '' }
const discount = { id: 'code-id', code: 'SAVE', discountType: 'percentage', discountAmount: 10 }
function squareOrder(overrides: Record<string, unknown> = {}, metadata: Record<string, string> = {}) {
    return {
        order: {
            id: 'order',
            state: 'OPEN',
            locationId: 'location',
            totalMoney: { currency: 'AUD', amount: 900n },
            discounts: [{ uid: 'discount-code', appliedMoney: { amount: 100n } }],
            metadata: {
                program: 'party-form',
                customerEmail: 'parent@example.com',
                customerName: 'Parent Test',
                discountCode: 'SAVE',
                discountCodeId: 'code-id',
                giftCardId: '',
                giftCardCents: '0',
                ...metadata,
            },
            ...overrides,
        },
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOrder.mockResolvedValue(squareOrder())
    mocks.take.mockResolvedValue('https://receipt.example.com')
    mocks.receipt.mockResolvedValue('https://receipt.example.com')
    mocks.checkDiscount.mockResolvedValue(discount)
    mocks.findDiscount.mockResolvedValue([discount])
    mocks.hasRedemption.mockResolvedValue(false)
})

describe('paying a checkout', () => {
    it('re-checks the discount code, takes the payment and records the code use against the order', async () => {
        expect(await payCheckout(input)).toEqual({ status: 'paid', receiptUrl: 'https://receipt.example.com' })
        expect(mocks.checkDiscount).toHaveBeenCalledWith('SAVE', 'parent@example.com')
        expect(mocks.take).toHaveBeenCalledOnce()
        expect(mocks.createRedemption).toHaveBeenCalledWith(
            expect.objectContaining({ bookingType: 'party-form', amountCents: 900, customerName: 'Parent Test' }),
            'order'
        )
        expect(mocks.updateDiscount).toHaveBeenCalledWith('SAVE', expect.anything())
    })
    it('returns paid for an order that is already paid, without charging again', async () => {
        mocks.getOrder.mockResolvedValue(squareOrder({ state: 'COMPLETED', tenders: [{ paymentId: 'card-payment' }] }))
        expect(await payCheckout(input)).toEqual({ status: 'paid', receiptUrl: 'https://receipt.example.com' })
        expect(mocks.take).not.toHaveBeenCalled()
        expect(mocks.receipt).toHaveBeenCalledWith(['card-payment'])
        expect(mocks.createRedemption).toHaveBeenCalledOnce()
    })
    it('counts the discount code once however many times the payment is replayed', async () => {
        mocks.getOrder.mockResolvedValue(squareOrder({ state: 'COMPLETED', tenders: [{ paymentId: 'card-payment' }] }))
        mocks.hasRedemption.mockResolvedValue(true)
        await payCheckout(input)
        expect(mocks.createRedemption).not.toHaveBeenCalled()
        expect(mocks.updateDiscount).not.toHaveBeenCalled()
    })
    it('only pays an order carrying the booking metadata it was prepared with', async () => {
        await expect(payCheckout({ ...input, metadata: { answersHash: 'other' } })).rejects.toThrow(
            'refresh the payment summary'
        )
        mocks.getOrder.mockResolvedValue(squareOrder({}, { answersHash: 'answers' }))
        expect((await payCheckout({ ...input, metadata: { answersHash: 'answers' } })).status).toBe('paid')
    })
    it('refuses a discount code that expired or changed since the checkout was prepared', async () => {
        mocks.checkDiscount.mockResolvedValueOnce('expired')
        await expect(payCheckout(input)).rejects.toThrow('no longer available')
        mocks.checkDiscount.mockResolvedValueOnce({ ...discount, discountAmount: 20 })
        await expect(payCheckout(input)).rejects.toThrow('no longer available')
        expect(mocks.take).not.toHaveBeenCalled()
    })
    it('reports processing after an unclear failure so the same request can be replayed', async () => {
        mocks.take.mockRejectedValueOnce(new Error('Connection closed'))
        expect(await payCheckout(input)).toEqual({ status: 'processing' })
        expect(mocks.createRedemption).not.toHaveBeenCalled()
    })
    it('passes a declined card back to the customer', async () => {
        const { PaymentMethodInvalidError } = await import('@/app/trpc/trpc.errors')
        mocks.take.mockRejectedValueOnce(
            Object.assign(new Error('Payment failed'), { cause: new PaymentMethodInvalidError() })
        )
        await expect(payCheckout(input)).rejects.toThrow('Payment failed')
    })
    it('asks for card details when the gift card does not cover the order', async () => {
        await expect(payCheckout({ ...input, token: '' })).rejects.toThrow('enter your card details')
        mocks.getOrder.mockResolvedValue(
            squareOrder({}, { discountCodeId: '', giftCardId: 'gift', giftCardCents: '900' })
        )
        expect((await payCheckout({ ...input, token: '' })).status).toBe('paid')
    })
    it('rejects orders that are not open checkouts', async () => {
        mocks.getOrder.mockResolvedValue(squareOrder({ state: 'CANCELED' }))
        await expect(payCheckout(input)).rejects.toThrow('no longer available')
        mocks.getOrder.mockResolvedValue({ order: { id: 'order', state: 'OPEN', metadata: {} } })
        await expect(payCheckout(input)).rejects.toThrow('refresh the payment summary')
    })
})
