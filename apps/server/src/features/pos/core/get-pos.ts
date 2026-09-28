import { getSquareLocationId, PRODUCTS_SQUARE_CATEGORY, type PosOption, type Studio } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { canUseTerminalCheckout } from '@/features/payments/core/terminal-checkout-access'
import { isSoldAtLocation } from '@/integrations/square/core/get-catalog-item-options'
import { listCatalogCategoryItems } from '@/integrations/square/core/list-catalog-category-items'

/**
 * What staff can sell at a studio: the Square 'Products' items sold there, in Square's order. `blocked` explains why
 * the studio can't sell yet.
 */
export async function getPos(studio: Studio, uid: string) {
    const blocked = await getBlockedReason(studio, uid)
    if (blocked) return { blocked } as const
    return { blocked: null, products: await getStudioProducts(studio) } as const
}

/** Why staff (`uid`) can't sell at a studio, if they can't. */
export async function getBlockedReason(studio: Studio, uid: string) {
    return (await canUseTerminalCheckout(studio, uid)) ? null : "Selling products isn't available at this studio yet."
}

export async function getStudioProducts(studio: Studio): Promise<PosOption[]> {
    const locationId = getSquareLocationId(env === 'prod' ? studio : 'test')
    const items = await listCatalogCategoryItems(PRODUCTS_SQUARE_CATEGORY[env])
    return items.flatMap((item) =>
        // a variably priced item can't be sold without a price
        item.variationId && item.priceCents !== null && isSoldAtLocation(item, locationId)
            ? [
                  {
                      variationId: item.variationId,
                      name: item.name,
                      description: item.description,
                      imageUrl: item.imageUrl,
                      priceCents: item.priceCents,
                  },
              ]
            : []
    )
}
