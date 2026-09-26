import { logger } from 'firebase-functions/v2'

import {
    getSquareLocationId,
    mapSquareItemToPartyAddition,
    PARTY_ADDITIONS_SQUARE_CATEGORY,
    type PartyFormV2Addition,
    type Studio,
} from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { isSoldAtLocation } from '@/integrations/square/core/get-catalog-item-options'
import { listCatalogCategoryItems } from '@/integrations/square/core/list-catalog-category-items'

export type PartyFormV2AdditionOption = {
    key: PartyFormV2Addition
    name: string
    description: string | null
    imageUrl: string | null
    priceCents: number | null
}

/**
 * The food additions offered at a studio: the Square 'Additional Options' items sold there,
 * in Square's category order. Items without an addition key mapping are skipped.
 */
export async function getPartyFormV2Additions(studio: Studio): Promise<PartyFormV2AdditionOption[]> {
    const locationId = getSquareLocationId(env === 'prod' ? studio : 'test')
    const items = await listCatalogCategoryItems(PARTY_ADDITIONS_SQUARE_CATEGORY[env])

    return items
        .filter((item) => isSoldAtLocation(item, locationId))
        .flatMap((item) => {
            const key = mapSquareItemToPartyAddition(env, item.id)
            if (!key) {
                logger.warn('Square party addition has no addition key mapping and was not offered', {
                    itemId: item.id,
                    name: item.name,
                })
                return []
            }
            return [
                {
                    key,
                    name: item.name,
                    description: item.description,
                    imageUrl: item.imageUrl,
                    priceCents: item.priceCents,
                },
            ]
        })
}
