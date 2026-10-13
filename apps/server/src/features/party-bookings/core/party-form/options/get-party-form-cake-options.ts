import { getSquareLocationId, PARTY_CAKE_SQUARE_CATALOG, type Studio } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { getCakeSuppliesByOption } from '@/features/inventory/core/inventory.cake-supplies'
import { getOrderableInventory } from '@/features/inventory/core/inventory.reservations'
import {
    type CatalogOption,
    getCatalogItemOptions,
    isSoldAtLocation,
} from '@/integrations/square/core/get-catalog-item-options'

export type PartyFormCakeOption = {
    id: string
    name: string
    priceCents: number
    imageUrl: string | null
    /** Studio-stock cake designs only: none left to order at the studio, so it's shown but can't be chosen. */
    soldOut?: boolean
}

export type PartyFormCakeOptions = {
    sizes: PartyFormCakeOption[]
    designs: PartyFormCakeOption[]
    flavours: PartyFormCakeOption[]
    servingOptions: PartyFormCakeOption[]
    candleOptions: PartyFormCakeOption[]
    minFlavours: number
    maxFlavours: number
    /** Studio-stock cakes come already made in these flavours, so parents aren't asked. `null` means parents choose. */
    fixedFlavours: string[] | null
}

/**
 * Everything on the cake step comes from the Square cake item: sizes are its variations; designs, flavours,
 * serving and candles are its modifier lists. Options not sold or sold out at the studio are left out, and prices use
 * the studio's price where Square has one.
 */
export async function getPartyFormCakeOptions(studio: Studio): Promise<PartyFormCakeOptions> {
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
        fixedFlavours: null,
    }
}

/** The flavours every studio-stock cake comes in, matched to Square flavour names. */
const STOCKED_CAKE_FLAVOURS = ['chocolate', 'vanilla']

/**
 * Studio-stock cakes (see `getPartyCakeSource`) come from the monthly delivery: medium only, already chocolate and
 * vanilla, and only designs the studio stocks in inventory (marked sold out when none are left). Paid serving and
 * candle options are only offered where the studio stocks the supplies they use (no waffle cones). Square still provides
 * names, photos and prices.
 */
export async function getStockedPartyFormCakeOptions(studio: Studio): Promise<PartyFormCakeOptions> {
    const [options, orderable, supplies] = await Promise.all([
        getPartyFormCakeOptions(studio),
        getOrderableInventory(studio),
        getCakeSuppliesByOption(studio),
    ])
    // 'bring my own' options are free and need nothing from the studio
    const suppliedHere = (option: PartyFormCakeOption) => option.priceCents === 0 || supplies.has(option.id)
    const mediumId = PARTY_CAKE_SQUARE_CATALOG[env].mediumSizeVariationId
    const fixedFlavours = options.flavours.filter((flavour) =>
        STOCKED_CAKE_FLAVOURS.some((name) => flavour.name.toLowerCase().includes(name))
    )
    if (fixedFlavours.length !== STOCKED_CAKE_FLAVOURS.length) {
        throw new Error(`Square cake flavours must include ${STOCKED_CAKE_FLAVOURS.join(' and ')} at '${studio}'`)
    }

    return {
        ...options,
        sizes: options.sizes.filter((size) => size.id === mediumId),
        // every design the studio stocks is shown, so parents can see what's sold out
        designs: options.designs.flatMap((design) => {
            const stock = orderable.get(design.id)
            return stock ? [{ ...design, soldOut: stock.available <= 0 }] : []
        }),
        servingOptions: options.servingOptions.filter(suppliedHere),
        candleOptions: options.candleOptions.filter(suppliedHere),
        flavours: fixedFlavours,
        minFlavours: fixedFlavours.length,
        maxFlavours: fixedFlavours.length,
        fixedFlavours: fixedFlavours.map((flavour) => flavour.name),
    }
}
