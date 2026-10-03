import { getInventoryStockLevelId } from '@fizz-kidz/core'
import type { InventoryActor, Studio } from '@fizz-kidz/core'

import { sendInventoryAlerts } from './inventory.alerts'
import { applyInventoryStockChange } from './inventory.stock.changes'

import type { InventoryStockWrite } from './inventory.alerts'
import type { InventoryStockChange } from './inventory.stock.changes'

import { DatabaseClient } from '@/integrations/firebase/database.client'

export type InventoryStockChangeLine = { itemId: string; change: InventoryStockChange; reason?: string }

/**
 * Applies stock changes for one studio atomically, writing one movement per change, then alerts the owners
 * about anything that needs attention. Every stock change goes through here.
 */
export async function writeInventoryStockChanges(input: {
    location: Studio
    changes: InventoryStockChangeLine[]
    actor: InventoryActor
    /** See `DatabaseClient.runInventoryStockTransaction`. */
    idempotencyKey?: string
}): Promise<InventoryStockWrite[]> {
    const itemIds = input.changes.map((change) => change.itemId)
    if (new Set(itemIds).size !== itemIds.length) {
        throw new Error('Each item can only appear once in a stock change')
    }

    const writes = await DatabaseClient.runInventoryStockTransaction({
        location: input.location,
        itemIds,
        idempotencyKey: input.idempotencyKey,
        buildWrites: ({ items, stockLevels, createMovementId, now }) =>
            input.changes.map(({ itemId, change, reason }) => {
                const item = items.get(itemId)!
                const before = stockLevels.get(itemId)
                return {
                    item,
                    before,
                    ...applyInventoryStockChange({
                        item,
                        location: input.location,
                        stockLevel: before,
                        stockLevelId: getInventoryStockLevelId(input.location, itemId),
                        change,
                        reason,
                        actor: input.actor,
                        movementId: createMovementId(itemId),
                        now,
                    }),
                }
            }),
    })

    await sendInventoryAlerts(input.location, writes)

    return writes
}
