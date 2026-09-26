import { describe, expect, it, vi } from 'vite-plus/test'

import { getSquareLocationId, PARTY_TAKE_HOME_SQUARE_CATALOG } from '@fizz-kidz/core'

import { getPartyFormV2TakeHomeOptions } from '../get-party-form-v2-take-home-options'

const { getItemOptions, listItems, unitPrices } = vi.hoisted(() => ({
    getItemOptions: vi.fn(),
    listItems: vi.fn(),
    unitPrices: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('firebase-functions/v2', () => ({ logger: { warn: vi.fn() } }))
vi.mock('@/integrations/square/core/get-catalog-item-options', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getCatalogItemOptions: getItemOptions,
}))
vi.mock('@/integrations/square/core/list-catalog-category-items', () => ({ listCatalogCategoryItems: listItems }))
vi.mock('@/integrations/square/core/calculate-catalog-unit-prices', () => ({ calculateCatalogUnitPrices: unitPrices }))

const catalog = PARTY_TAKE_HOME_SQUARE_CATALOG.prod
const malvern = getSquareLocationId('malvern')

describe('party form take-home options from Square', () => {
    it('maps Square bags and kits on the online store and sold at the studio to booking keys, priced at the minimum quantity', async () => {
        getItemOptions.mockResolvedValue({
            name: 'Take Home Bags',
            description: null,
            channels: [catalog.onlineStoreChannelId],
            modifierLists: new Map(),
            variations: [
                {
                    id: catalog.takeHomeBags.lollyBags,
                    name: 'Lolly Bags',
                    priceCents: 640,
                    imageUrl: 'https://images.example.com/lolly.jpg',
                    locationOverrides: [],
                    locationIds: null,
                    absentAtLocationIds: [],
                },
                {
                    id: catalog.takeHomeBags.lollyToyMixBags,
                    name: 'Lolly/Toy Mix Bags',
                    priceCents: 640,
                    imageUrl: null,
                    // stock counts don't apply to made-to-order goodies, so Square's automatic sold-out is ignored
                    locationOverrides: [{ locationId: malvern, priceCents: null, soldOut: true }],
                    locationIds: null,
                    absentAtLocationIds: [],
                },
            ],
        })
        const kit = (variationId: string | null, name: string, overrides = {}) => ({
            id: `${name}-item`,
            variationId,
            name,
            description: null,
            imageUrl: `https://images.example.com/${name}.jpg`,
            priceCents: 1995,
            locationIds: null,
            absentAtLocationIds: [],
            channels: [catalog.onlineStoreChannelId],
            ...overrides,
        })
        listItems.mockResolvedValue([
            kit(catalog.products.bathBombKit, 'Bath Bomb Kit'),
            kit('UNMAPPED', 'Mystery Kit'),
            // not switched on for the online store, so not offered on the party form
            kit(catalog.products.stringSlimeKit, 'String Slime Kit', { channels: ['CH_POINT_OF_SALE'] }),
            kit(catalog.products.soapMakingKit, 'Soap Making Kit', { absentAtLocationIds: [malvern] }),
        ])
        unitPrices.mockResolvedValue(
            new Map([
                [catalog.takeHomeBags.lollyToyMixBags, 640],
                [catalog.products.bathBombKit, 1295],
            ])
        )

        const result = await getPartyFormV2TakeHomeOptions('malvern')

        expect(result).toEqual({
            takeHomeBags: [
                {
                    key: 'lollyBags',
                    name: 'Lolly Bags',
                    description: null,
                    imageUrl: 'https://images.example.com/lolly.jpg',
                    priceCents: 640,
                    regularPriceCents: 640,
                },
                {
                    key: 'lollyToyMixBags',
                    name: 'Lolly/Toy Mix Bags',
                    description: null,
                    imageUrl: null,
                    priceCents: 640,
                    regularPriceCents: 640,
                },
            ],
            products: [
                {
                    key: 'bathBombKit',
                    name: 'Bath Bomb Kit',
                    description: null,
                    imageUrl: 'https://images.example.com/Bath Bomb Kit.jpg',
                    priceCents: 1295,
                    regularPriceCents: 1995,
                },
            ],
            minimumQuantity: 12,
        })
        expect(getItemOptions).toHaveBeenCalledWith(catalog.takeHomeBagItemId)
        expect(listItems).toHaveBeenCalledWith(catalog.productCategoryId)
        expect(unitPrices).toHaveBeenCalledWith(
            malvern,
            [catalog.takeHomeBags.lollyBags, catalog.takeHomeBags.lollyToyMixBags, catalog.products.bathBombKit],
            12
        )
    })

    it('offers no bags when the take-home bag item is off the online store', async () => {
        getItemOptions.mockResolvedValue({
            name: 'Take Home Bags',
            description: null,
            channels: ['CH_POINT_OF_SALE'],
            modifierLists: new Map(),
            variations: [
                {
                    id: catalog.takeHomeBags.lollyBags,
                    name: 'Lolly Bags',
                    priceCents: 640,
                    imageUrl: null,
                    locationOverrides: [],
                    locationIds: null,
                    absentAtLocationIds: [],
                },
            ],
        })
        listItems.mockResolvedValue([])
        unitPrices.mockResolvedValue(new Map())

        expect((await getPartyFormV2TakeHomeOptions('malvern')).takeHomeBags).toEqual([])
    })

    it('hides a bag at a studio it is not sold at', async () => {
        getItemOptions.mockResolvedValue({
            name: 'Take Home Bags',
            description: null,
            channels: [catalog.onlineStoreChannelId],
            modifierLists: new Map(),
            variations: [
                {
                    id: catalog.takeHomeBags.lollyBags,
                    name: 'Lolly Bags',
                    priceCents: 640,
                    imageUrl: null,
                    locationOverrides: [],
                    locationIds: null,
                    absentAtLocationIds: [malvern],
                },
            ],
        })
        listItems.mockResolvedValue([])
        unitPrices.mockResolvedValue(new Map())

        expect((await getPartyFormV2TakeHomeOptions('malvern')).takeHomeBags).toEqual([])
    })
})
