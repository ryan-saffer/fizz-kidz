import { PARTY_CAKE_SQUARE_CATALOG, PARTY_TAKE_HOME_SQUARE_CATALOG } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { getCatalogItemOptions } from '@/integrations/square/core/get-catalog-item-options'

export type InventorySquareOption = { id: string; name: string; group: 'Cake designs' | 'Take-home bags' }

/** The Square catalog objects customers order that an inventory item can be linked to. */
export async function listInventorySquareOptions(): Promise<InventorySquareOption[]> {
    const cakeCatalog = PARTY_CAKE_SQUARE_CATALOG[env]
    const [cake, takeHomeBags] = await Promise.all([
        getCatalogItemOptions(cakeCatalog.itemId),
        getCatalogItemOptions(PARTY_TAKE_HOME_SQUARE_CATALOG[env].takeHomeBagItemId),
    ])

    return [
        ...(cake.modifierLists.get(cakeCatalog.designListId)?.modifiers ?? []).map(({ id, name }) => ({
            id,
            name,
            group: 'Cake designs' as const,
        })),
        ...takeHomeBags.variations.map(({ id, name }) => ({ id, name, group: 'Take-home bags' as const })),
    ]
}
