import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PartyFormV2 } from '@fizz-kidz/core'

import { validatePartyFormV2 } from '../validate-party-form-v2'

const mocks = vi.hoisted(() => ({
    booking: vi.fn(),
    map: vi.fn(),
    cakeOptions: vi.fn(),
    takeHomeOptions: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: { getPartyBooking: mocks.booking } }))
vi.mock('../../../party-form-mapper', () => ({
    PartyFormMapper: class {
        mapToBooking = mocks.map
    },
}))
vi.mock('../../build-party-form-v2-submission', () => ({ buildPartyFormV2Submission: vi.fn() }))
vi.mock('@/integrations/sanity/sanity.client', () => ({
    SanityClient: { getInstance: async () => ({ getBirthdayPartyBookingCatalogue: async () => ({}) }) },
}))
vi.mock('../../options/get-party-form-v2-cake-options', () => ({ getPartyFormV2CakeOptions: mocks.cakeOptions }))
vi.mock('../../options/get-party-form-v2-take-home-options', () => ({
    getPartyFormV2TakeHomeOptions: mocks.takeHomeOptions,
}))

const payload: PartyFormV2 = {
    mode: 'party',
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
const cake: NonNullable<PartyFormV2['cake']> = {
    selection: 'Rainbow Ice-Cream Cake',
    size: 'Small (12-15 serves)',
    flavours: ['Vanilla', 'Mango'],
    served: 'Ice-cream cup with spoon',
    candles: 'Include candles',
}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.booking.mockResolvedValue({
        type: 'studio',
        location: 'malvern',
        partyLength: '1.5',
        parentEmail: 'booked-parent@example.com',
        parentFirstName: 'Booked',
        parentLastName: 'Parent',
        childName: 'Charlie',
        childAge: 7,
        includesFood: true,
    })
    mocks.cakeOptions.mockResolvedValue({
        sizes: [{ id: 'size-small', name: 'Small (12-15 serves)', priceCents: 8900, imageUrl: null }],
        designs: [{ id: 'design-rainbow', name: 'Rainbow Ice-Cream Cake', priceCents: 0, imageUrl: null }],
        flavours: [
            { id: 'flavour-vanilla', name: 'Vanilla', priceCents: 0, imageUrl: null },
            { id: 'flavour-mango', name: 'Mango', priceCents: 0, imageUrl: null },
            { id: 'flavour-lemon', name: 'Lemon', priceCents: 0, imageUrl: null },
        ],
        servingOptions: [{ id: 'serving-cup', name: 'Ice-cream cup with spoon', priceCents: 1900, imageUrl: null }],
        candleOptions: [{ id: 'candles-include', name: 'Include candles', priceCents: 1200, imageUrl: null }],
        minFlavours: 1,
        maxFlavours: 2,
    })
})
describe('validating party form answers', () => {
    it('builds the paid line items from the answers', async () => {
        const { lineItems, discounts } = await validatePartyFormV2(payload)
        expect(lineItems).toEqual([{ quantity: '12', catalogObjectId: expect.any(String) }])
        expect(discounts).toEqual([])
    })
    it('orders only a cake and goodies with the cake form, skipping the party questions', async () => {
        const { lineItems } = await validatePartyFormV2({
            mode: 'cake',
            bookingId: 'booking',
            takeHomeBags: { lollyBags: 12 },
            products: {},
        })
        expect(lineItems).toHaveLength(1)
        await expect(
            validatePartyFormV2({ mode: 'cake', bookingId: 'booking', takeHomeBags: {}, products: {} })
        ).rejects.toThrow('Please choose a cake or take-home goodies')
    })
    it('refuses a second cake when the booking already has one', async () => {
        mocks.booking.mockResolvedValue({ type: 'studio', location: 'malvern', cake: { selection: 'Rainbow' } })
        await expect(
            validatePartyFormV2({ mode: 'cake', bookingId: 'booking', cake, takeHomeBags: {}, products: {} })
        ).rejects.toThrow('already been ordered')
    })
    it('refuses a cake where cakes cannot be ordered', async () => {
        mocks.booking.mockResolvedValue({ type: 'studio', location: 'geelong' })
        await expect(
            validatePartyFormV2({ mode: 'cake', bookingId: 'booking', cake, takeHomeBags: {}, products: {} })
        ).rejects.toThrow('not available for this party')
    })
    it('requires 12 of a take-home item, unless the booking already has some', async () => {
        const order = (takeHomeBags: PartyFormV2['takeHomeBags']) =>
            validatePartyFormV2({ mode: 'cake', bookingId: 'booking', takeHomeBags, products: {} })
        await expect(order({ lollyBags: 3 })).rejects.toThrow('minimum of 12')
        mocks.booking.mockResolvedValue({ type: 'studio', location: 'malvern', takeHomeBags: { lollyBags: 12 } })
        await expect(order({ lollyBags: 3 })).resolves.toBeTruthy()
        await expect(order({ lollyToyMixBags: 3 })).rejects.toThrow('minimum of 12')
    })
    it('keeps the kit bulk price for a top-up of fewer than 12 kits', async () => {
        const kit = {
            name: 'Bath Bomb Kit',
            description: null,
            imageUrl: null,
            priceCents: 1295,
            regularPriceCents: 1995,
        }
        mocks.takeHomeOptions.mockResolvedValue({
            takeHomeBags: [],
            products: [
                { key: 'bathBombKit', ...kit },
                { key: 'soapMakingKit', ...kit, name: 'Soap Making Kit' },
            ],
            minimumQuantity: 12,
        })
        const order = (products: PartyFormV2['products']) =>
            validatePartyFormV2({ mode: 'cake', bookingId: 'booking', takeHomeBags: {}, products })
        mocks.booking.mockResolvedValue({ type: 'studio', location: 'malvern', products: { bathBombKit: 12 } })
        expect(await order({ bathBombKit: 3 })).toMatchObject({
            lineItems: [expect.objectContaining({ quantity: '3', appliedDiscounts: [{ discountUid: 'bathBombKit' }] })],
            discounts: [
                expect.objectContaining({ uid: 'bathBombKit', amountMoney: { currency: 'AUD', amount: 2100n } }),
            ],
        })
        // 12 or more kits in the order get Square's bulk price on their own
        expect((await order({ bathBombKit: 3, soapMakingKit: 12 })).discounts).toEqual([])
        mocks.takeHomeOptions.mockClear()
        mocks.booking.mockResolvedValue({ type: 'studio', location: 'malvern' })
        await order({ bathBombKit: 12 })
        expect(mocks.takeHomeOptions).not.toHaveBeenCalled()
    })
    it('builds the cake line from Square size, serving, candle, design and flavour options, and rejects unavailable or extra choices', async () => {
        const cakeLine = (await validatePartyFormV2({ ...payload, cake })).lineItems[0]
        expect(cakeLine).toMatchObject({
            catalogObjectId: 'size-small',
            name: 'Rainbow Ice-Cream Cake - Small (12-15 serves)',
        })
        expect(cakeLine.modifiers?.map((modifier) => modifier.catalogObjectId)).toEqual([
            'serving-cup',
            'candles-include',
            'design-rainbow',
            'flavour-vanilla',
            'flavour-mango',
        ])
        expect(mocks.cakeOptions).toHaveBeenCalledWith('malvern')

        const invalidCakes: NonNullable<PartyFormV2['cake']>[] = [
            { ...cake, selection: 'Retired Ice-Cream Cake' },
            { ...cake, size: 'Huge (100 serves)' },
            { ...cake, served: 'Golden bowls' },
            { ...cake, flavours: ['Vanilla', 'Bubblegum'] },
            { ...cake, flavours: ['Vanilla', 'Vanilla'] },
        ]
        for (const invalid of invalidCakes) {
            await expect(validatePartyFormV2({ ...payload, cake: invalid })).rejects.toThrow('no longer available')
        }
        await expect(
            validatePartyFormV2({ ...payload, cake: { ...cake, flavours: ['Vanilla', 'Mango', 'Lemon'] } })
        ).rejects.toThrow('between 1 and 2')
    })
    it('rejects wrong creation counts, duplicates, and answers the Paperform pipeline cannot map', async () => {
        await expect(
            validatePartyFormV2({ ...payload, creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime'] }] })
        ).rejects.toThrow('exactly 2')
        await expect(
            validatePartyFormV2({
                ...payload,
                creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'fluffySlime'] }],
            })
        ).rejects.toThrow('different creations')
        mocks.map.mockImplementationOnce(() => {
            throw new Error("Invalid creation form value found: 'Crunchy Slime'")
        })
        await expect(validatePartyFormV2(payload)).rejects.toThrow('no longer available')
    })
    it('keeps food choices to studio parties', async () => {
        mocks.booking.mockResolvedValue({ type: 'mobile', location: 'malvern', partyLength: '1' })
        await expect(validatePartyFormV2({ ...payload, numberOfChildren: '12' })).rejects.toThrow(
            'only available for studio parties'
        )
    })
})
