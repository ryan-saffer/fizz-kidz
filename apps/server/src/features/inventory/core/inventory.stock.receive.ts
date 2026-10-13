import { z } from 'zod'

import type { InventoryActor } from '@fizz-kidz/core'

import { studioSchema } from './inventory.schemas'
import { writeInventoryStockChanges } from './inventory.stock.write'

export const receiveInventoryStockInputSchema = z.object({
    location: studioSchema,
    /** One line per item in the delivery. */
    lines: z
        .array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive() }))
        .min(1)
        .refine((lines) => new Set(lines.map((line) => line.itemId)).size === lines.length, 'Each item once only'),
    note: z.string().trim().optional(),
})

export type ReceiveInventoryStockInput = z.infer<typeof receiveInventoryStockInputSchema>

/** Adds a physically checked delivery to stock. */
export async function receiveInventoryStock(input: ReceiveInventoryStockInput, actor: InventoryActor) {
    const writes = await writeInventoryStockChanges({
        location: input.location,
        actor,
        changes: input.lines.map((line) => ({
            itemId: line.itemId,
            change: { $type: 'received', quantity: line.quantity },
            reason: input.note || undefined,
        })),
    })

    return writes.map((write) => write.stockLevel)
}
