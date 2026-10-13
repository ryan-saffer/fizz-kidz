import { PARTY_CAKE_SQUARE_CATALOG, PARTY_TAKE_HOME_SQUARE_CATALOG } from '@fizz-kidz/core'
import type { InventoryCategory } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { getCatalogItemOptions } from '@/integrations/square/core/get-catalog-item-options'

export type InventorySquareOption = { id: string; name: string; category: InventoryCategory }

/**
 * The Square catalog objects an inventory item can be linked to, by the category of item that links to them: cake
 * designs, the paid serving and candle options that use up cake supplies, and take-home bags.
 */
export async function listInventorySquareOptions(): Promise<InventorySquareOption[]> {
    const cakeCatalog = PARTY_CAKE_SQUARE_CATALOG[env]
    const [cake, takeHomeBags] = await Promise.all([
        getCatalogItemOptions(cakeCatalog.itemId),
        getCatalogItemOptions(PARTY_TAKE_HOME_SQUARE_CATALOG[env].takeHomeBagItemId),
    ])
    const modifiers = (listId: string) => cake.modifierLists.get(listId)?.modifiers ?? []
    // 'bring my own' options are free and use nothing up
    const paid = (listId: string, label: string) =>
        modifiers(listId)
            .filter((modifier) => modifier.priceCents > 0)
            .map(({ id, name }) => ({ id, name: `${label}: ${name}`, category: 'cake-supplies' as const }))

    return [
        ...modifiers(cakeCatalog.designListId).map(({ id, name }) => ({ id, name, category: 'cakes' as const })),
        ...paid(cakeCatalog.servingListId, 'Serving'),
        ...paid(cakeCatalog.candleListId, 'Candles'),
        ...takeHomeBags.variations.map(({ id, name }) => ({ id, name, category: 'take-home-bags' as const })),
    ]
}
