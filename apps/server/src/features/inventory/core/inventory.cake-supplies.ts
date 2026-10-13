import { getCakeSupplyQuantity, isLinkedInventoryItem } from '@fizz-kidz/core'
import type { QuantityTrackedInventoryItem, Studio } from '@fizz-kidz/core'

import { writeInventoryStockChanges } from './inventory.stock.write'

import { DatabaseClient } from '@/integrations/firebase/database.client'

type CakeSupply = QuantityTrackedInventoryItem & { squareCatalogObjectId: string }

/**
 * The cake supplies a studio stocks, by the Square serving or candle option that uses them (cups and spoons can share
 * one). Supplies are never limited on the party form, but a paid option with no supplies isn't offered at studios that
 * sell from studio stock, eg. waffle cones at Werribee.
 */
export async function getCakeSuppliesByOption(location: Studio) {
    const [items, stockLevels] = await Promise.all([
        DatabaseClient.listInventoryItems(),
        DatabaseClient.listInventoryStockLevels({ location }),
    ])
    const stocked = new Set(
        stockLevels.filter((stockLevel) => stockLevel.stocked).map((stockLevel) => stockLevel.itemId)
    )

    const supplies = new Map<string, CakeSupply[]>()
    items.forEach((item) => {
        if (item.category !== 'cake-supplies' || !isLinkedInventoryItem(item) || !stocked.has(item.id)) return
        supplies.set(item.squareCatalogObjectId, [...(supplies.get(item.squareCatalogObjectId) ?? []), item])
    })
    return supplies
}

/**
 * The party is over and paid, so the cake supplies it used come off stock: one per party (candles) or 1.5 per child
 * (cups, spoons). Safe to repeat.
 */
export async function useCakeSuppliesForBooking(input: {
    location: Studio
    bookingId: string
    /** The Square serving and candle options the booking's cake was ordered with. */
    optionIds: string[]
    children: number
}) {
    const supplies = await getCakeSuppliesByOption(input.location)
    const items = [
        ...new Map(input.optionIds.flatMap((id) => supplies.get(id) ?? []).map((item) => [item.id, item])).values(),
    ]
    if (items.length === 0) return

    await writeInventoryStockChanges({
        location: input.location,
        actor: { $type: 'system' },
        idempotencyKey: `${input.bookingId}-supplies-used`,
        changes: items.map((item) => ({
            itemId: item.id,
            change: {
                $type: 'used',
                bookingId: input.bookingId,
                quantity: getCakeSupplyQuantity(item.usedPer ?? 'party', input.children),
            },
        })),
    })
}
