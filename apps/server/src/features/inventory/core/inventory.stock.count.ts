import { z } from 'zod'

import type { InventoryActor } from '@fizz-kidz/core'

import { studioSchema } from './inventory.schemas'
import { writeInventoryStockChanges } from './inventory.stock.write'

export const countInventoryStockInputSchema = z.object({
    location: studioSchema,
    /** One line per item counted. Several lines are a stocktake saved together, eg. every cake in the freezer. */
    lines: z
        .array(
            z.object({
                itemId: z.string().min(1),
                /** `null` marks the count unknown. */
                quantity: z.number().int().nonnegative().nullable(),
            })
        )
        .min(1)
        .refine((lines) => new Set(lines.map((line) => line.itemId)).size === lines.length, 'Each item once only'),
    reason: z.string().trim().optional(),
})

export type CountInventoryStockInput = z.infer<typeof countInventoryStockInputSchema>

/**
 * Records a physical count. For orderable items the count includes reserved stock, and a count that doesn't match
 * needs a reason (see `applyInventoryStockChange`) and alerts the owners, in one email for the whole count.
 */
export async function countInventoryStock(input: CountInventoryStockInput, actor: InventoryActor) {
    const writes = await writeInventoryStockChanges({
        location: input.location,
        actor,
        changes: input.lines.map((line) => ({
            itemId: line.itemId,
            change: { $type: 'counted', quantity: line.quantity },
            reason: input.reason || undefined,
        })),
    })

    return writes.map((write) => write.stockLevel)
}
