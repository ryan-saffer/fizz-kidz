import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'

import { inventoryCategorySchema, inventoryKeySchema, inventoryUnitSchema } from './inventory.schemas'

import { DatabaseClient } from '@/integrations/firebase/database.client'

export const updateInventoryItemInputSchema = z.object({
    itemId: z.string().min(1),
    item: z.union([
        z.object({
            $trackingMode: z.literal('quantity'),
            name: z.string().min(1).optional(),
            inventoryKey: inventoryKeySchema.nullable().optional(),
            category: inventoryCategorySchema.optional(),
            status: z.enum(['active', 'archived']).optional(),
            baseUnit: inventoryUnitSchema,
            runningLowThreshold: z.number().nonnegative().nullable(),
            squareCatalogObjectId: z.string().trim().min(1).nullable().optional(),
            notes: z.string().optional(),
        }),
        z.object({
            $trackingMode: z.literal('qualitative'),
            name: z.string().min(1).optional(),
            inventoryKey: inventoryKeySchema.nullable().optional(),
            category: inventoryCategorySchema.optional(),
            status: z.enum(['active', 'archived']).optional(),
            baseUnit: inventoryUnitSchema.optional(),
            notes: z.string().optional(),
        }),
        z.object({
            name: z.string().min(1).optional(),
            inventoryKey: inventoryKeySchema.nullable().optional(),
            category: inventoryCategorySchema.optional(),
            status: z.enum(['active', 'archived']).optional(),
            notes: z.string().optional(),
        }),
    ]),
})

export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemInputSchema>

export async function updateInventoryItem(input: UpdateInventoryItemInput) {
    const { inventoryKey, squareCatalogObjectId, ...item } = {
        squareCatalogObjectId: undefined as string | null | undefined,
        ...input.item,
    }

    await DatabaseClient.updateInventoryItem(input.itemId, {
        ...item,
        inventoryKey: inventoryKey === null ? FieldValue.delete() : inventoryKey,
        ...(squareCatalogObjectId !== undefined && {
            squareCatalogObjectId: squareCatalogObjectId === null ? FieldValue.delete() : squareCatalogObjectId,
        }),
        updatedAt: new Date(),
    })

    return DatabaseClient.getInventoryItem(input.itemId)
}
