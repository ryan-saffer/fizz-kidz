import {
    STOCKED_PARTY_ORDER_STUDIOS,
    STUDIOS,
    getInventoryStockLevelId,
    isOrderableInventoryItem,
} from '@fizz-kidz/core'
import type { InventoryItem, InventoryStockLevel } from '@fizz-kidz/core'

import { inventoryItemInputSchema } from './inventory.schemas'

import type { z } from 'zod'

import { DatabaseClient } from '@/integrations/firebase/database.client'

export const createInventoryItemInputSchema = inventoryItemInputSchema

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemInputSchema>

export async function createInventoryItem(input: CreateInventoryItemInput) {
    const now = new Date()
    const itemId = await DatabaseClient.createInventoryItemId()
    const item: InventoryItem = {
        ...input,
        id: itemId,
        createdAt: now,
        updatedAt: now,
    }
    // orderable items are only stocked where customers order from studio stock, and start empty so the first delivery
    // can be received straight away
    const isOrderable = isOrderableInventoryItem(item)
    const stockLevels: InventoryStockLevel[] = STUDIOS.map((location) => ({
        id: getInventoryStockLevelId(location, itemId),
        itemId,
        location,
        stocked: isOrderable ? STOCKED_PARTY_ORDER_STUDIOS.includes(location) : true,
        measurement:
            item.$trackingMode === 'quantity'
                ? { $type: 'quantity', quantity: isOrderable ? 0 : null }
                : { $type: 'qualitative', level: 'unknown' },
        ...(isOrderable && { reservedQuantity: 0 }),
        updatedAt: now,
    }))

    await DatabaseClient.setInventoryDocuments({ items: [item], stockLevels })

    return DatabaseClient.getInventoryItem(itemId)
}
