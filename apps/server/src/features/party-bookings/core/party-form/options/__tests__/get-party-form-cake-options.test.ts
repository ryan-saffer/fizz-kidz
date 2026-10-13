import { describe, expect, it, vi } from 'vite-plus/test'

import { getSquareLocationId, PARTY_CAKE_SQUARE_CATALOG } from '@fizz-kidz/core'

import { getPartyFormCakeOptions, getStockedPartyFormCakeOptions } from '../get-party-form-cake-options'

const { getOptions, orderable, supplies } = vi.hoisted(() => ({
    getOptions: vi.fn(),
    orderable: vi.fn(),
    supplies: vi.fn(),
}))
vi.mock('@/features/inventory/core/inventory.cake-supplies', () => ({ getCakeSuppliesByOption: supplies }))
vi.mock('@/features/inventory/core/inventory.reservations', () => ({ getOrderableInventory: orderable }))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/square/core/get-catalog-item-options', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getCatalogItemOptions: getOptions,
}))

const { itemId, designListId, flavourListId, servingListId, candleListId } = PARTY_CAKE_SQUARE_CATALOG.dev
const studio = getSquareLocationId('test')
const option = (
    id: string,
    priceCents = 0,
    locationOverrides: object[] = [],
    presence: { locationIds: string[] | null; absentAtLocationIds: string[] } = {
        locationIds: null,
        absentAtLocationIds: [],
    }
) => ({ id, name: `${id} name`, priceCents, imageUrl: null, locationOverrides, ...presence })
const list = (
    id: string,
    modifiers: ReturnType<typeof option>[],
    minSelected: number | null = null,
    maxSelected: number | null = null
) => [id, { id, name: id, minSelected, maxSelected, modifiers }] as const

describe('party form cake options from Square', () => {
    it('returns every cake option sold (and not sold out) at the studio, with studio prices and the flavour limits', async () => {
        getOptions.mockResolvedValue({
            variations: [
                option('small', 8900, [{ locationId: studio, priceCents: 9900, soldOut: false }]),
                option('large', 14900, [{ locationId: studio, priceCents: null, soldOut: true }]),
            ],
            modifierLists: new Map([
                list(
                    designListId,
                    [
                        option('rainbow'),
                        option('minecraft', 0, [{ locationId: studio, priceCents: null, soldOut: true }]),
                    ],
                    1,
                    1
                ),
                list(
                    flavourListId,
                    [
                        option('vanilla'),
                        option('mango'),
                        option('lemon', 0, [], { locationIds: null, absentAtLocationIds: [studio] }),
                        option('mint', 0, [], { locationIds: ['another-studio'], absentAtLocationIds: [] }),
                    ],
                    1,
                    2
                ),
                list(servingListId, [option('cup', 1900)]),
                list(candleListId, [option('candles', 1200), option('own-candles')]),
            ]),
        })

        const result = await getPartyFormCakeOptions('malvern')

        expect(result.sizes).toEqual([{ id: 'small', name: 'small name', priceCents: 9900, imageUrl: null }])
        expect(result.designs.map(({ id }) => id)).toEqual(['rainbow'])
        expect(result.flavours.map(({ id }) => id)).toEqual(['vanilla', 'mango'])
        expect(result.servingOptions).toEqual([{ id: 'cup', name: 'cup name', priceCents: 1900, imageUrl: null }])
        expect(result.candleOptions.map(({ priceCents }) => priceCents)).toEqual([1200, 0])
        expect(result).toMatchObject({ minFlavours: 1, maxFlavours: 2 })
        expect(getOptions).toHaveBeenCalledWith(itemId)
    })

    it('fails when a cake modifier list is missing from the cake item', async () => {
        getOptions.mockResolvedValue({ variations: [], modifierLists: new Map() })
        await expect(getPartyFormCakeOptions('malvern')).rejects.toThrow('not enabled on the cake item')
    })

    it('offers studio-stock cakes in medium only, chocolate and vanilla, showing stocked designs and which are sold out', async () => {
        const medium = PARTY_CAKE_SQUARE_CATALOG.dev.mediumSizeVariationId
        getOptions.mockResolvedValue({
            variations: [option('small'), { ...option(medium), name: 'Medium' }],
            modifierLists: new Map([
                list(designListId, [option('rainbow'), option('unicorn'), option('dino')]),
                list(flavourListId, [
                    { ...option('choc'), name: 'Chocolate' },
                    { ...option('van'), name: 'Vanilla' },
                    option('mango'),
                ]),
                list(servingListId, [option('cup', 1900), option('waffle-cone', 1900), option('own-bowls')]),
                list(candleListId, [option('candles', 1200), option('own-candles')]),
            ]),
        })
        // the studio stocks cups and spoons but not waffle cones or candles
        supplies.mockResolvedValue(new Map([['cup', [{ id: 'cups' }, { id: 'spoons' }]]]))
        orderable.mockResolvedValue(
            new Map([
                ['unicorn', { available: 2 }],
                ['dino', { available: 0 }],
            ])
        )

        const result = await getStockedPartyFormCakeOptions('werribee')

        expect(orderable).toHaveBeenCalledWith('werribee')
        expect(result.sizes.map(({ id }) => id)).toEqual([medium])
        // rainbow isn't stocked at the studio, so it isn't shown at all
        expect(result.designs.map(({ id, soldOut }) => [id, soldOut])).toEqual([
            ['unicorn', false],
            ['dino', true],
        ])
        expect(result).toMatchObject({ minFlavours: 2, maxFlavours: 2, fixedFlavours: ['Chocolate', 'Vanilla'] })
        // paid options are only offered where the studio stocks their supplies; 'bring my own' always is
        expect(result.servingOptions.map(({ id }) => id)).toEqual(['cup', 'own-bowls'])
        expect(result.candleOptions.map(({ id }) => id)).toEqual(['own-candles'])
    })
})
