import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PartyForm } from '@fizz-kidz/core'

import { validatePartyForm } from '../validate-party-form'

const mocks = vi.hoisted(() => ({
    booking: vi.fn(),
    cakeOptions: vi.fn(),
    stockedCakeOptions: vi.fn(),
    takeHomeOptions: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: { getPartyBooking: mocks.booking } }))
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
                        creations: [{ key: 'fluffySlime' }, { key: 'crunchySlime' }],
                    },
                ],
            }),
        }),
    },
}))
vi.mock('../../options/get-party-form-cake-options', () => ({
    getPartyFormCakeOptions: mocks.cakeOptions,
    getStockedPartyFormCakeOptions: mocks.stockedCakeOptions,
}))
vi.mock('../../options/get-party-form-take-home-options', () => ({
    getPartyFormTakeHomeOptions: mocks.takeHomeOptions,
}))

const payload: PartyForm = {
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
const cake: NonNullable<PartyForm['cake']> = {
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
        const { lineItems, discounts } = await validatePartyForm(payload)
        expect(lineItems).toEqual([{ quantity: '12', catalogObjectId: expect.any(String) }])
        expect(discounts).toEqual([])
    })
    it('orders only a cake and goodies with the cake form, skipping the party questions', async () => {
        const { lineItems } = await validatePartyForm({
            mode: 'cake',
            bookingId: 'booking',
            takeHomeBags: { lollyBags: 12 },
            products: {},
        })
        expect(lineItems).toHaveLength(1)
        await expect(
            validatePartyForm({ mode: 'cake', bookingId: 'booking', takeHomeBags: {}, products: {} })
        ).rejects.toThrow('Please choose a cake or take-home goodies')
    })
    it('refuses a second cake when the booking already has one', async () => {
        mocks.booking.mockResolvedValue({ type: 'studio', location: 'malvern', cake: { selection: 'Rainbow' } })
        await expect(
            validatePartyForm({ mode: 'cake', bookingId: 'booking', cake, takeHomeBags: {}, products: {} })
        ).rejects.toThrow('already been ordered')
    })
    it('refuses a cake where cakes cannot be ordered', async () => {
        mocks.booking.mockResolvedValue({ type: 'mobile', location: 'malvern' })
        await expect(
            validatePartyForm({ mode: 'cake', bookingId: 'booking', cake, takeHomeBags: {}, products: {} })
        ).rejects.toThrow('not available for this party')
    })
    describe('at studios selling from studio stock', () => {
        const stockedCake: NonNullable<PartyForm['cake']> = {
            ...cake,
            size: 'Medium (20-25 serves)',
            flavours: ['Chocolate', 'Vanilla'],
        }
        beforeEach(() => {
            mocks.booking.mockResolvedValue({ type: 'studio', location: 'werribee', partyLength: '1.5' })
            mocks.stockedCakeOptions.mockResolvedValue({
                sizes: [{ id: 'size-medium', name: 'Medium (20-25 serves)', priceCents: 11900, imageUrl: null }],
                designs: [{ id: 'design-rainbow', name: 'Rainbow Ice-Cream Cake', priceCents: 0, imageUrl: null }],
                flavours: [
                    { id: 'flavour-chocolate', name: 'Chocolate', priceCents: 0, imageUrl: null },
                    { id: 'flavour-vanilla', name: 'Vanilla', priceCents: 0, imageUrl: null },
                ],
                servingOptions: [
                    { id: 'serving-cup', name: 'Ice-cream cup with spoon', priceCents: 1900, imageUrl: null },
                ],
                candleOptions: [{ id: 'candles-include', name: 'Include candles', priceCents: 1200, imageUrl: null }],
                minFlavours: 2,
                maxFlavours: 2,
                fixedFlavours: ['Chocolate', 'Vanilla'],
            })
            mocks.takeHomeOptions.mockResolvedValue({
                takeHomeBags: [{ key: 'lollyBags', name: 'Lolly Bags', available: 15 }],
                products: [],
            })
        })
        it('sells an available cake on the party form, from the stocked options', async () => {
            const { lineItems } = await validatePartyForm({ ...payload, takeHomeBags: {}, cake: stockedCake })
            expect(mocks.cakeOptions).not.toHaveBeenCalled()
            expect(lineItems).toEqual([expect.objectContaining({ catalogObjectId: 'size-medium' })])
        })
        it('only sells studio-stock cakes on the party form, not the cake form', async () => {
            await expect(
                validatePartyForm({
                    mode: 'cake',
                    bookingId: 'booking',
                    cake: stockedCake,
                    takeHomeBags: {},
                    products: {},
                })
            ).rejects.toThrow('not available for this party')
        })
        it('refuses a design that has just sold out', async () => {
            mocks.stockedCakeOptions.mockResolvedValue({
                ...(await mocks.stockedCakeOptions()),
                designs: [
                    {
                        id: 'design-rainbow',
                        name: 'Rainbow Ice-Cream Cake',
                        priceCents: 0,
                        imageUrl: null,
                        soldOut: true,
                    },
                ],
            })
            await expect(validatePartyForm({ ...payload, takeHomeBags: {}, cake: stockedCake })).rejects.toThrow(
                'has just sold out'
            )

            await expect(
                validatePartyForm({
                    ...payload,
                    takeHomeBags: {},
                    cake: { ...stockedCake, selection: 'Unicorn Ice-Cream Cake' },
                })
            ).rejects.toThrow('has just sold out')
        })
        it('refuses more take-home bags than the studio has available', async () => {
            await expect(validatePartyForm({ ...payload, takeHomeBags: { lollyBags: 16 } })).rejects.toThrow(
                'only 15 Lolly Bags are left'
            )
            await expect(validatePartyForm({ ...payload, takeHomeBags: { lollyBags: 15 } })).resolves.toBeTruthy()
        })
    })
    it('requires 12 of a take-home item, unless the booking already has some', async () => {
        const order = (takeHomeBags: PartyForm['takeHomeBags']) =>
            validatePartyForm({ mode: 'cake', bookingId: 'booking', takeHomeBags, products: {} })
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
        const order = (products: PartyForm['products']) =>
            validatePartyForm({ mode: 'cake', bookingId: 'booking', takeHomeBags: {}, products })
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
        const cakeLine = (await validatePartyForm({ ...payload, cake })).lineItems[0]
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

        const invalidCakes: NonNullable<PartyForm['cake']>[] = [
            { ...cake, selection: 'Retired Ice-Cream Cake' },
            { ...cake, size: 'Huge (100 serves)' },
            { ...cake, served: 'Golden bowls' },
            { ...cake, flavours: ['Vanilla', 'Bubblegum'] },
            { ...cake, flavours: ['Vanilla', 'Vanilla'] },
        ]
        for (const invalid of invalidCakes) {
            await expect(validatePartyForm({ ...payload, cake: invalid })).rejects.toThrow('no longer available')
        }
        await expect(
            validatePartyForm({ ...payload, cake: { ...cake, flavours: ['Vanilla', 'Mango', 'Lemon'] } })
        ).rejects.toThrow('between 1 and 2')
    })
    it('rejects wrong creation counts, duplicates, and creations not offered for the party', async () => {
        await expect(
            validatePartyForm({ ...payload, creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime'] }] })
        ).rejects.toThrow('exactly 2')
        await expect(
            validatePartyForm({
                ...payload,
                creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'fluffySlime'] }],
            })
        ).rejects.toThrow('different creations')
        await expect(
            validatePartyForm({
                ...payload,
                creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'retiredSlime'] }],
            })
        ).rejects.toThrow('no longer available')
        // crunchy slime is studio-only
        mocks.booking.mockResolvedValue({ type: 'mobile', location: 'malvern', partyLength: '1' })
        await expect(
            validatePartyForm({ ...payload, numberOfChildren: '12', foodPackage: undefined, additions: [] })
        ).rejects.toThrow('no longer available')
    })
    it('keeps food choices to studio parties', async () => {
        mocks.booking.mockResolvedValue({ type: 'mobile', location: 'malvern', partyLength: '1' })
        await expect(validatePartyForm({ ...payload, numberOfChildren: '12' })).rejects.toThrow(
            'only available for studio parties'
        )
    })
})
