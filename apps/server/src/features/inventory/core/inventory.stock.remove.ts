import { z } from 'zod'

import type { InventoryActor } from '@fizz-kidz/core'

import { studioSchema } from './inventory.schemas'
import { writeInventoryStockChanges } from './inventory.stock.write'

export const removeInventoryStockInputSchema = z.object({
    location: studioSchema,
    itemId: z.string().min(1),
    quantity: z.number().int().positive(),
    reason: z.string().trim().min(1, 'Give a reason'),
})

export type RemoveInventoryStockInput = z.infer<typeof removeInventoryStockInputSchema>

/** Takes stock out that left the studio some other way, eg. thrown out or damaged. */
export async function removeInventoryStock(input: RemoveInventoryStockInput, actor: InventoryActor) {
    const [write] = await writeInventoryStockChanges({
        location: input.location,
        actor,
        changes: [
            { itemId: input.itemId, change: { $type: 'removed', quantity: input.quantity }, reason: input.reason },
        ],
    })

    return write.stockLevel
}
