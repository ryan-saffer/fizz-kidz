import { z } from 'zod'

import type { InventoryActor } from '@fizz-kidz/core'

import { qualitativeStockLevelSchema, studioSchema } from './inventory.schemas'
import { writeInventoryStockChanges } from './inventory.stock.write'

export const updateInventoryStockLevelInputSchema = z.object({
    location: studioSchema,
    itemId: z.string().min(1),
    level: qualitativeStockLevelSchema,
})

export type UpdateInventoryStockLevelInput = z.infer<typeof updateInventoryStockLevelInputSchema>

export async function updateInventoryStockLevel(input: UpdateInventoryStockLevelInput, actor: InventoryActor) {
    const [write] = await writeInventoryStockChanges({
        location: input.location,
        actor,
        changes: [{ itemId: input.itemId, change: { $type: 'level-updated', level: input.level } }],
    })

    return write.stockLevel
}
