import { describe, expect, it, vi } from 'vite-plus/test'

import { getSquareLocationId, PARTY_CAKE_SQUARE_CATALOG } from '@fizz-kidz/core'

import { getPartyFormV2CakeOptions } from '../get-party-form-v2-cake-options'

const { getOptions } = vi.hoisted(() => ({ getOptions: vi.fn() }))
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

        const result = await getPartyFormV2CakeOptions('malvern')

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
        await expect(getPartyFormV2CakeOptions('malvern')).rejects.toThrow('not enabled on the cake item')
    })
})
