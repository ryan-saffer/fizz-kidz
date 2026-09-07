import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PartyFormV2 } from '@fizz-kidz/core'

import { preparePartyFormV2 } from './prepare-party-form-v2'

const mocks = vi.hoisted(() => ({
    booking: vi.fn(),
    save: vi.fn(),
    calculate: vi.fn(),
    create: vi.fn(),
    discount: vi.fn(),
    gift: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: { getPartyBooking: mocks.booking, createPartyFormV2Submission: mocks.save },
}))
vi.mock('../party-form-mapper', () => ({
    PartyFormMapper: class {
        mapToBooking() {}
    },
}))
vi.mock('./build-party-form-v2-submission', () => ({ buildPartyFormV2Submission: vi.fn() }))
vi.mock('@/integrations/sanity/sanity.client', () => ({
    SanityClient: {
        getInstance: async () => ({
            getBirthdayPartyBookingCatalogue: async () => ({
                creations: [
                    { key: 'fluffySlime', status: 'active', bookingChannels: ['studio', 'mobile'] },
                    { key: 'crunchySlime', status: 'active', bookingChannels: ['studio'] },
                ],
                packages: [
                    {
                        key: 'slime',
                        status: 'active',
                        position: 1,
                        creations: [
                            { key: 'fluffySlime', bookingOrder: 1 },
                            { key: 'crunchySlime', bookingOrder: 2 },
                        ],
                    },
                ],
            }),
        }),
    },
}))
vi.mock('@/integrations/square/core/get-or-create-customer', () => ({ getOrCreateCustomer: async () => 'customer' }))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => ({ orders: { calculate: mocks.calculate, create: mocks.create } }) },
}))
vi.mock('@/features/holiday-programs/core/discount-codes/check-discount-code', () => ({
    checkDiscountCode: mocks.discount,
}))
vi.mock('@/features/gift-cards/check-gift-card-balance', () => ({ checkGiftCardBalance: mocks.gift }))

const payload: PartyFormV2 = {
    bookingId: 'booking',
    parentFirstName: 'Alex',
    parentLastName: 'Smith',
    childName: 'Charlie',
    childAge: '7',
    numberOfChildren: '12 - 15',
    foodPackage: 'include',
    additions: ['fairyBread'],
    creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'crunchySlime'] }],
    takeHomeBags: { lollyBags: 12 },
    products: {},
}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.booking.mockResolvedValue({
        type: 'studio',
        location: 'malvern',
        partyLength: '1.5',
        parentEmail: 'booked-parent@example.com',
    })
    mocks.calculate.mockResolvedValue({ order: { totalMoney: { amount: 10000n } } })
    mocks.create.mockImplementation(async ({ order }) => ({
        order: {
            id: 'order',
            totalMoney: { currency: 'AUD', amount: 10000n - (order.discounts?.[0]?.amountMoney.amount ?? 0n) },
        },
    }))
    mocks.discount.mockResolvedValue({ id: 'discount', code: 'SAVE', discountType: 'percentage', discountAmount: 10 })
    mocks.gift.mockResolvedValue({ giftCardId: 'gift', state: 'ACTIVE', balanceCents: 4000, last4: '1234' })
})
describe('prepare party form checkout', () => {
    it('prices catalogue items on the server and applies a discount before the gift card', async () => {
        const quote = await preparePartyFormV2({ payload, discountCode: 'SAVE', giftCardNumber: 'gift-number' })
        expect(quote).toMatchObject({
            subtotalCents: 10000,
            discountCents: 1000,
            totalCents: 9000,
            giftCardCents: 4000,
            cardCents: 5000,
            parentEmail: 'booked-parent@example.com',
        })
        expect(mocks.discount).toHaveBeenCalledWith('SAVE', 'booked-parent@example.com')
        expect(mocks.calculate.mock.calls[0][0].order.lineItems).toHaveLength(1)
        expect(mocks.calculate.mock.calls[0][0].order.lineItems[0]).toMatchObject({
            quantity: '12',
            catalogObjectId: expect.any(String),
        })
        expect(mocks.save.mock.calls[0][3]).toMatchObject({ orderId: 'order', giftCardId: 'gift', state: 'ready' })
        expect(JSON.stringify(mocks.save.mock.calls[0])).not.toContain('gift-number')
    })
    it('handles fixed discounts and gift cards covering the entire balance', async () => {
        mocks.discount.mockResolvedValue({ id: 'discount', code: 'SAVE', discountType: 'price', discountAmount: 20 })
        mocks.gift.mockResolvedValue({ giftCardId: 'gift', state: 'ACTIVE', balanceCents: 15000, last4: '1234' })
        expect(
            await preparePartyFormV2({ payload, discountCode: 'SAVE', giftCardNumber: 'gift-number' })
        ).toMatchObject({ discountCents: 2000, totalCents: 8000, giftCardCents: 8000, cardCents: 0 })
    })
    it('rejects expired discounts before creating an order', async () => {
        mocks.discount.mockResolvedValue('expired')
        await expect(preparePartyFormV2({ payload, discountCode: 'SAVE', giftCardNumber: '' })).rejects.toThrow(
            'expired'
        )
        expect(mocks.create).not.toHaveBeenCalled()
    })
    it('does not create a Square order for answers without paid extras', async () => {
        const quote = await preparePartyFormV2({
            payload: { ...payload, takeHomeBags: {} },
            discountCode: '',
            giftCardNumber: '',
        })
        expect(quote.totalCents).toBe(0)
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.save.mock.calls[0][3].orderId).toBeNull()
    })
    it('rejects wrong counts, duplicate creations and studio-only choices on mobile parties', async () => {
        await expect(
            preparePartyFormV2({
                payload: { ...payload, creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime'] }] },
                discountCode: '',
                giftCardNumber: '',
            })
        ).rejects.toThrow('exactly 2')
        await expect(
            preparePartyFormV2({
                payload: {
                    ...payload,
                    creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'fluffySlime'] }],
                },
                discountCode: '',
                giftCardNumber: '',
            })
        ).rejects.toThrow('different creations')
        mocks.booking.mockResolvedValue({ type: 'mobile', location: 'malvern', partyLength: '1' })
        await expect(
            preparePartyFormV2({
                payload: { ...payload, numberOfChildren: '12', foodPackage: undefined, additions: [] },
                discountCode: '',
                giftCardNumber: '',
            })
        ).rejects.toThrow('no longer available')
        expect(mocks.create).not.toHaveBeenCalled()
    })
})
