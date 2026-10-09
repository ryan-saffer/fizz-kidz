import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PartyFormV2 } from '@fizz-kidz/core'

import { getCheckoutMetadata, preparePartyFormV2 } from '../prepare-party-form-v2'

const mocks = vi.hoisted(() => ({ validate: vi.fn(), checkout: vi.fn() }))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('../validate-party-form-v2', () => ({ validatePartyFormV2: mocks.validate }))
vi.mock('@/features/payments/core/prepare-checkout', () => ({ prepareCheckout: mocks.checkout }))

const booking = {
    location: 'malvern',
    parentEmail: 'booked-parent@example.com',
    parentFirstName: 'Booked',
    parentLastName: 'Parent',
}
const cakeForm: PartyFormV2 = { mode: 'cake', bookingId: 'booking', takeHomeBags: { lollyBags: 12 }, products: {} }
const lineItems = [{ quantity: '12', catalogObjectId: 'lolly-bags' }]

beforeEach(() => {
    vi.clearAllMocks()
    mocks.validate.mockResolvedValue({ booking, lineItems, discounts: [] })
    mocks.checkout.mockResolvedValue({ checkoutId: 'square-order', totalCents: 7680 })
})

describe('preparing the party form checkout', () => {
    it('prepares a checkout tied to the booking and the exact answers', async () => {
        expect(await preparePartyFormV2({ payload: cakeForm, discountCode: 'SAVE', giftCardNumber: '' })).toEqual({
            checkoutId: 'square-order',
            totalCents: 7680,
        })
        expect(mocks.checkout).toHaveBeenCalledWith(
            expect.objectContaining({
                program: 'party-form',
                customer: { firstName: 'Booked', lastName: 'Parent', email: 'booked-parent@example.com' },
                lineItems,
                metadata: { bookingId: 'booking', answersHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
                discountCode: 'SAVE',
            })
        )
        expect(getCheckoutMetadata(cakeForm)).toEqual(getCheckoutMetadata({ ...cakeForm }))
        expect(getCheckoutMetadata(cakeForm)).not.toEqual(
            getCheckoutMetadata({ ...cakeForm, takeHomeBags: { lollyBags: 13 } })
        )
    })
    it('has nothing to pay, and creates no Square order, without a cake or goodies', async () => {
        mocks.validate.mockResolvedValue({ booking, lineItems: [], discounts: [] })
        expect(await preparePartyFormV2({ payload: cakeForm, discountCode: '', giftCardNumber: '' })).toMatchObject({
            checkoutId: null,
            totalCents: 0,
            customerEmail: 'booked-parent@example.com',
        })
        expect(mocks.checkout).not.toHaveBeenCalled()
    })
})
