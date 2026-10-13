import { isOrderableInventoryCategory } from '@fizz-kidz/core'
import type { InventoryCategory } from '@fizz-kidz/core'

import { InventoryStockChangeError } from './inventory.stock.changes'

import { DatabaseClient } from '@/integrations/firebase/database.client'

/**
 * Each Square cake design or bag can be linked to one item only. Otherwise one item's stock would silently decide what
 * the party form offers for the other, which looks like the two are swapped. Cake supplies can share a link (cups and
 * spoons are both used by the 'cup with spoon' serving option).
 */
export async function assertSquareLinkAvailable(input: {
    squareCatalogObjectId: string | null | undefined
    /** The item's category, or for an update that doesn't change it, `undefined` to look it up. */
    category: InventoryCategory | undefined
    itemId?: string
}) {
    const { squareCatalogObjectId, itemId } = input
    if (!squareCatalogObjectId) return
    const category = input.category ?? (itemId ? (await DatabaseClient.getInventoryItem(itemId)).category : undefined)
    if (!category || !isOrderableInventoryCategory(category)) return

    const items = await DatabaseClient.listInventoryItems({ includeArchived: true })
    const linked = items.find(
        (item) =>
            item.id !== itemId &&
            isOrderableInventoryCategory(item.category) &&
            'squareCatalogObjectId' in item &&
            item.squareCatalogObjectId === squareCatalogObjectId
    )
    if (linked) {
        throw new InventoryStockChangeError(
            `That Square item is already linked to '${linked.name}'. Unlink it there first.`
        )
    }
}
