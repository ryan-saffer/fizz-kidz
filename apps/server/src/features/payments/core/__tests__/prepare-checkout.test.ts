import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { prepareCheckout, type PrepareCheckoutInput } from '../prepare-checkout'

const mocks = vi.hoisted(() => ({ calculate: vi.fn(), create: vi.fn(), discount: vi.fn(), gift: vi.fn() }))
vi.mock('@/integrations/square/core/get-or-create-customer', () => ({ getOrCreateCustomer: async () => 'customer' }))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => ({ orders: { calculate: mocks.calculate, create: mocks.create } }) },
}))
vi.mock('@/features/discount-codes/core/check-discount-code', () => ({
    checkDiscountCode: mocks.discount,
}))
vi.mock('@/features/gift-cards/check-gift-card-balance', () => ({ checkGiftCardBalance: mocks.gift }))

const input: PrepareCheckoutInput = {
    program: 'party-form',
    sourceName: 'Party Form',
    locationId: 'location',
    customer: { firstName: 'Alex', lastName: 'Smith', email: 'parent@example.com' },
    lineItems: [{ quantity: '12', catalogObjectId: 'lolly-bags' }],
    metadata: { bookingId: 'booking' },
}
const totalAfter = (order: { discounts?: { amountMoney: { amount: bigint } }[] }) =>
    10000n - (order.discounts?.[0]?.amountMoney.amount ?? 0n)

beforeEach(() => {
    vi.clearAllMocks()
    mocks.calculate.mockImplementation(async ({ order }) => ({
        order: {
            totalMoney: { amount: totalAfter(order) },
            lineItems: [
                {
                    quantity: '1',
                    name: 'Unicorn Ice-Cream Cake - Large',
                    totalMoney: { amount: 10000n },
                    modifiers: [
                        { name: 'Waffle Cones', totalPriceMoney: { amount: 1900n } },
                        { name: 'Unicorn Ice-Cream Cake', totalPriceMoney: { amount: 0n } },
                    ],
                },
            ],
        },
    }))
    mocks.create.mockImplementation(async ({ order }) => ({
        order: { id: 'square-order', totalMoney: { currency: 'AUD', amount: totalAfter(order) } },
    }))
    mocks.discount.mockResolvedValue({ id: 'code-id', code: 'SAVE', discountType: 'percentage', discountAmount: 10 })
    mocks.gift.mockResolvedValue({ giftCardId: 'gift', state: 'ACTIVE', balanceCents: 4000, last4: '1234' })
})

describe('preparing a checkout', () => {
    it('prices the items in Square, applies the discount code before the gift card, and keeps it all on the order', async () => {
        const summary = await prepareCheckout({ ...input, discountCode: 'SAVE', giftCardNumber: 'gift-number' })
        expect(summary).toEqual({
            checkoutId: 'square-order',
            locationId: 'location',
            customerEmail: 'parent@example.com',
            subtotalCents: 10000,
            discountCents: 1000,
            discountCode: 'SAVE',
            totalCents: 9000,
            giftCardCents: 4000,
            giftCardLast4: '1234',
            cardCents: 5000,
            items: [
                { label: '1 × Unicorn Ice-Cream Cake - Large', amountCents: 8100 },
                { label: 'Waffle Cones', amountCents: 1900 },
            ],
        })
        const { order } = mocks.create.mock.calls[0][0]
        expect(order.pricingOptions).toEqual({ autoApplyDiscounts: true })
        expect(order.discounts[0]).toMatchObject({ uid: 'discount-code', scope: 'ORDER', type: 'FIXED_AMOUNT' })
        expect(order.metadata).toEqual({
            bookingId: 'booking',
            program: 'party-form',
            customerEmail: 'parent@example.com',
            customerName: 'Alex Smith',
            discountCode: 'SAVE',
            discountCodeId: 'code-id',
            giftCardId: 'gift',
            giftCardCents: '4000',
        })
        expect(JSON.stringify(order, (_, value) => (typeof value === 'bigint' ? String(value) : value))).not.toContain(
            'gift-number'
        )
    })
    it('leaves empty values off the order metadata, which Square rejects', async () => {
        await prepareCheckout(input)
        expect(mocks.create.mock.calls[0][0].order.metadata).toEqual({
            bookingId: 'booking',
            program: 'party-form',
            customerEmail: 'parent@example.com',
            customerName: 'Alex Smith',
        })
    })
    it('covers the whole order from a large enough gift card, and treats price codes as dollars', async () => {
        mocks.discount.mockResolvedValue({ id: 'code-id', code: 'SAVE', discountType: 'price', discountAmount: 20 })
        mocks.gift.mockResolvedValue({ giftCardId: 'gift', state: 'ACTIVE', balanceCents: 15000, last4: '1234' })
        expect(await prepareCheckout({ ...input, discountCode: 'SAVE', giftCardNumber: 'gift-number' })).toMatchObject({
            discountCents: 2000,
            totalCents: 8000,
            giftCardCents: 8000,
            cardCents: 0,
        })
    })
    it('rejects an unusable discount code or gift card before creating an order', async () => {
        mocks.discount.mockResolvedValueOnce('expired')
        await expect(prepareCheckout({ ...input, discountCode: 'SAVE' })).rejects.toThrow('expired')
        mocks.gift.mockResolvedValueOnce({ giftCardId: 'gift', state: 'ACTIVE', balanceCents: 0, last4: '1234' })
        await expect(prepareCheckout({ ...input, giftCardNumber: 'gift-number' })).rejects.toThrow(
            'no remaining balance'
        )
        expect(mocks.create).not.toHaveBeenCalled()
    })
    it('lets a price code larger than the order cover all of it', async () => {
        mocks.discount.mockResolvedValue({ id: 'code-id', code: 'SAVE', discountType: 'price', discountAmount: 150 })
        expect(await prepareCheckout({ ...input, discountCode: 'SAVE' })).toMatchObject({
            discountCents: 10000,
            totalCents: 0,
            cardCents: 0,
        })
    })
})
