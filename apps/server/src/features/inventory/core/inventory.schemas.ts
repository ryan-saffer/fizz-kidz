import { z } from 'zod'

import {
    ADDITIONS,
    INVENTORY_CATEGORIES,
    INVENTORY_QUALITATIVE_STOCK_LEVELS,
    INVENTORY_USAGE_RULE_TYPES,
    isOrderableInventoryCategory,
    STUDIOS,
} from '@fizz-kidz/core'
import type { Addition, Studio } from '@fizz-kidz/core'

export const studioSchema = z.custom<Studio>((value) => typeof value === 'string' && STUDIOS.includes(value as Studio))
export const additionSchema = z.custom<Addition>((value) => typeof value === 'string' && value in ADDITIONS)

export const inventoryCategorySchema = z.enum(INVENTORY_CATEGORIES)
export const inventoryUnitSchema = z.string().trim().min(1).max(30)
export const qualitativeStockLevelSchema = z.enum(INVENTORY_QUALITATIVE_STOCK_LEVELS)
export const inventoryUsageRuleTypeSchema = z.enum(INVENTORY_USAGE_RULE_TYPES)
export const inventoryKeySchema = z.string().trim().min(1)
export const inventoryUsageRuleNameSchema = z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'Use letters, numbers, and hyphens only.')

const inventoryItemBaseInputSchema = z.discriminatedUnion('$trackingMode', [
    z.object({
        $trackingMode: z.literal('quantity'),
        name: z.string().min(1),
        inventoryKey: inventoryKeySchema.optional(),
        category: inventoryCategorySchema,
        status: z.enum(['active', 'archived']).default('active'),
        baseUnit: inventoryUnitSchema,
        runningLowThreshold: z.number().nonnegative().nullable(),
        squareCatalogObjectId: z.string().trim().min(1).optional(),
        notes: z.string().optional(),
    }),
    z.object({
        $trackingMode: z.literal('qualitative'),
        name: z.string().min(1),
        inventoryKey: inventoryKeySchema.optional(),
        category: inventoryCategorySchema,
        status: z.enum(['active', 'archived']).default('active'),
        baseUnit: inventoryUnitSchema.optional(),
        notes: z.string().optional(),
    }),
])

/** Cakes and take-home bags are counted exactly and linked to what customers order in Square. */
export const inventoryItemInputSchema = inventoryItemBaseInputSchema.refine(
    (item) =>
        !isOrderableInventoryCategory(item.category) ||
        (item.$trackingMode === 'quantity' && !!item.squareCatalogObjectId),
    { message: 'Cakes and take-home bags must be counted and linked to Square', path: ['squareCatalogObjectId'] }
)

export const inventoryUsageRuleQuantitySchema = z.discriminatedUnion('$operation', [
    z.object({
        $operation: z.literal('fixed'),
        quantity: z.number().positive(),
    }),
    z.object({
        $operation: z.literal('per-child'),
        quantityPerChild: z.number().positive(),
    }),
    z.object({
        $operation: z.literal('fixed-plus-per-child'),
        fixedQuantity: z.number().nonnegative(),
        quantityPerChild: z.number().positive(),
    }),
])

const inventoryUsageRuleBaseSchema = z.object({
    id: z.string().min(1),
    inventoryKey: inventoryKeySchema,
    label: z.string().optional(),
    status: z.enum(['active', 'archived']),
    quantity: inventoryUsageRuleQuantitySchema,
    notes: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
})

export const inventoryUsageRuleSchema = z.discriminatedUnion('$type', [
    inventoryUsageRuleBaseSchema.extend({
        $type: z.literal('party-base'),
    }),
    inventoryUsageRuleBaseSchema.extend({
        $type: z.literal('party-food-package'),
    }),
    inventoryUsageRuleBaseSchema.extend({
        $type: z.literal('party-addition'),
        addition: additionSchema,
    }),
])

export const inventoryUsageRuleInputSchema = z.discriminatedUnion('$type', [
    z.object({
        $type: z.literal('party-base'),
        name: inventoryUsageRuleNameSchema,
        label: z.string().optional(),
        status: z.enum(['active', 'archived']).default('active'),
        quantity: inventoryUsageRuleQuantitySchema,
        notes: z.string().optional(),
    }),
    z.object({
        $type: z.literal('party-food-package'),
        name: inventoryUsageRuleNameSchema,
        label: z.string().optional(),
        status: z.enum(['active', 'archived']).default('active'),
        quantity: inventoryUsageRuleQuantitySchema,
        notes: z.string().optional(),
    }),
    z.object({
        $type: z.literal('party-addition'),
        name: additionSchema,
        label: z.string().optional(),
        status: z.enum(['active', 'archived']).default('active'),
        quantity: inventoryUsageRuleQuantitySchema,
        notes: z.string().optional(),
    }),
])

export const inventoryShoppingListInputSchema = z
    .object({
        location: z.union([studioSchema, z.literal('master')]),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
    })
    .superRefine((value, ctx) => {
        if (value.endDate <= value.startDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['endDate'],
                message: 'End date must be after start date.',
            })
        }
    })
