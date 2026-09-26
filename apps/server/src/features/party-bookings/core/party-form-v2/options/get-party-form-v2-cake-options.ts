import { getSquareLocationId, PARTY_CAKE_SQUARE_CATALOG, type Studio } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import {
    type CatalogOption,
    getCatalogItemOptions,
    isSoldAtLocation,
} from '@/integrations/square/core/get-catalog-item-options'

export type PartyFormV2CakeOption = { id: string; name: string; priceCents: number; imageUrl: string | null }

export type PartyFormV2CakeOptions = {
    sizes: PartyFormV2CakeOption[]
    designs: PartyFormV2CakeOption[]
    flavours: PartyFormV2CakeOption[]
    servingOptions: PartyFormV2CakeOption[]
    candleOptions: PartyFormV2CakeOption[]
    minFlavours: number
    maxFlavours: number
}

/**
 * Everything on the cake step comes from the Square cake item: sizes are its variations; designs, flavours,
 * serving and candles are its modifier lists. Options not sold or sold out at the studio are left out, and prices use
 * the studio's price where Square has one.
 */
export async function getPartyFormV2CakeOptions(studio: Studio): Promise<PartyFormV2CakeOptions> {
    const { itemId, designListId, flavourListId, servingListId, candleListId } = PARTY_CAKE_SQUARE_CATALOG[env]
    const locationId = getSquareLocationId(env === 'prod' ? studio : 'test')
    const { variations, modifierLists } = await getCatalogItemOptions(itemId)

    const atStudio = (options: CatalogOption[]) =>
        options.flatMap((option) => {
            const { id, name, priceCents, imageUrl, locationOverrides } = option
            const override = locationOverrides.find((it) => it.locationId === locationId)
            if (!isSoldAtLocation(option, locationId) || override?.soldOut) return []
            return [{ id, name, imageUrl, priceCents: override?.priceCents ?? priceCents }]
        })
    const list = (listId: string) => {
        const modifierList = modifierLists.get(listId)
        if (!modifierList) throw new Error(`Square modifier list '${listId}' is not enabled on the cake item`)
        return modifierList
    }

    const flavourList = list(flavourListId)
    const flavours = atStudio(flavourList.modifiers)
    const minFlavours = Math.max(flavourList.minSelected ?? 1, 1)
    return {
        sizes: atStudio(variations),
        designs: atStudio(list(designListId).modifiers),
        flavours,
        servingOptions: atStudio(list(servingListId).modifiers),
        candleOptions: atStudio(list(candleListId).modifiers),
        minFlavours,
        maxFlavours: Math.max(flavourList.maxSelected ?? flavours.length, minFlavours),
    }
}
