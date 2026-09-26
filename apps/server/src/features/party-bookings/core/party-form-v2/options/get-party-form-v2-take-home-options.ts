import { logger } from 'firebase-functions/v2'

import {
    getSquareLocationId,
    mapSquareVariationToProduct,
    mapSquareVariationToTakeHomeBag,
    MIN_TAKE_HOME_QUANTITY,
    PARTY_TAKE_HOME_SQUARE_CATALOG,
    type ProductType,
    type Studio,
    type TakeHomeBagType,
} from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { calculateCatalogUnitPrices } from '@/integrations/square/core/calculate-catalog-unit-prices'
import { getCatalogItemOptions, isSoldAtLocation } from '@/integrations/square/core/get-catalog-item-options'
import { listCatalogCategoryItems } from '@/integrations/square/core/list-catalog-category-items'

export type PartyFormV2TakeHomeOption<K extends string> = {
    key: K
    name: string
    description: string | null
    imageUrl: string | null
    /** Square's unit price at the minimum quantity, after automatic discounts such as bulk pricing. */
    priceCents: number
    /** The catalogue price before those discounts. */
    regularPriceCents: number
}

export type PartyFormV2TakeHomeOptions = {
    takeHomeBags: PartyFormV2TakeHomeOption<TakeHomeBagType>[]
    products: PartyFormV2TakeHomeOption<ProductType>[]
    minimumQuantity: number
}

/**
 * Take-home bags are the variations of Square's take-home bag item; kits are the items in its Products category.
 * Only items on the 'Fizz Kidz Store' online channel are offered (the Dashboard's online store toggle), and only at
 * studios they're sold at. Stock levels are ignored. Anything without a booking key is left out.
 */
export async function getPartyFormV2TakeHomeOptions(studio: Studio): Promise<PartyFormV2TakeHomeOptions> {
    const { takeHomeBagItemId, productCategoryId, onlineStoreChannelId } = PARTY_TAKE_HOME_SQUARE_CATALOG[env]
    const onForm = (channels: string[]) => !onlineStoreChannelId || channels.includes(onlineStoreChannelId)
    const locationId = getSquareLocationId(env === 'prod' ? studio : 'test')
    const [bagItem, kits] = await Promise.all([
        getCatalogItemOptions(takeHomeBagItemId),
        listCatalogCategoryItems(productCategoryId),
    ])

    const bags = (onForm(bagItem.channels) ? bagItem.variations : [])
        // Goodies are ordered from the supplier per party, so Square's stock counts (and the sold-out flag they set
        // automatically) don't apply; 'not sold at this location' is the per-studio switch.
        .filter((variation) => isSoldAtLocation(variation, locationId))
        .flatMap((variation) => {
            const key = mapSquareVariationToTakeHomeBag(env, variation.id)
            if (!key) return unmapped(variation.id, variation.name)
            const override = variation.locationOverrides.find((it) => it.locationId === locationId)
            return [
                {
                    key,
                    variationId: variation.id,
                    name: variation.name,
                    description: bagItem.description,
                    imageUrl: variation.imageUrl,
                    regularPriceCents: override?.priceCents ?? variation.priceCents,
                },
            ]
        })
    const products = kits
        .filter((item) => onForm(item.channels) && isSoldAtLocation(item, locationId))
        .flatMap((item) => {
            const key = item.variationId ? mapSquareVariationToProduct(env, item.variationId) : undefined
            if (!key || !item.variationId) return unmapped(item.id, item.name)
            return [
                {
                    key,
                    variationId: item.variationId,
                    name: item.name,
                    description: item.description,
                    imageUrl: item.imageUrl,
                    regularPriceCents: item.priceCents ?? 0,
                },
            ]
        })

    const unitPrices = await calculateCatalogUnitPrices(
        locationId,
        [...bags, ...products].map((option) => option.variationId),
        MIN_TAKE_HOME_QUANTITY
    )
    return {
        takeHomeBags: withUnitPrices(bags, unitPrices),
        products: withUnitPrices(products, unitPrices),
        minimumQuantity: MIN_TAKE_HOME_QUANTITY,
    }
}

type UnpricedOption<K extends string> = Omit<PartyFormV2TakeHomeOption<K>, 'priceCents'> & { variationId: string }

function withUnitPrices<K extends string>(
    options: UnpricedOption<K>[],
    unitPrices: Map<string, number>
): PartyFormV2TakeHomeOption<K>[] {
    return options.map(({ variationId, ...option }) => ({
        ...option,
        priceCents: unitPrices.get(variationId) ?? option.regularPriceCents,
    }))
}

function unmapped(id: string, name: string): [] {
    logger.warn('Square take-home item has no booking key mapping and was not offered', { id, name })
    return []
}
