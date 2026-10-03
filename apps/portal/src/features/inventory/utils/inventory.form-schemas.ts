import { z } from 'zod'

import {
    INVENTORY_CATEGORIES,
    INVENTORY_QUALITATIVE_STOCK_LEVELS,
    INVENTORY_USAGE_RULE_TYPES,
    isOrderableInventoryCategory,
    isOrderableInventoryItem,
} from '@fizz-kidz/core'
import type {
    Addition,
    InventoryCategory,
    InventoryQualitativeStockLevel,
    InventoryUnit,
    InventoryUsageRule,
} from '@fizz-kidz/core'

import { parseInventoryKeyParts } from './inventory.usage-rules'
import { getCurrentQualitativeLevel, getCurrentQuantity } from './inventory.utils'

import type { ClientInventoryItem, StockAction } from './inventory.types'

const requiredNameSchema = z.string().trim().min(1, { message: 'Item name is required.' })
const unitSchema = z
    .string()
    .trim()
    .min(1, { message: 'Unit is required.' })
    .max(30, { message: 'Keep the unit short, eg. bag.' })
const optionalNonNegativeQuantitySchema = (label: string) =>
    z
        .string()
        .trim()
        .superRefine((value, ctx) => {
            if (!value) return

            const quantity = Number(value)
            if (!Number.isFinite(quantity) || quantity < 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be zero or greater.` })
            }
        })

const inventoryItemFormBaseSchema = z.discriminatedUnion('$trackingMode', [
    z.object({
        $trackingMode: z.literal('quantity'),
        name: requiredNameSchema,
        category: z.enum(INVENTORY_CATEGORIES),
        baseUnit: unitSchema,
        runningLowThreshold: optionalNonNegativeQuantitySchema('Running low threshold'),
        squareCatalogObjectId: z.string(),
        status: z.enum(['active', 'archived']),
        notes: z.string().trim(),
    }),
    z.object({
        $trackingMode: z.literal('qualitative'),
        name: requiredNameSchema,
        category: z.enum(INVENTORY_CATEGORIES),
        baseUnit: unitSchema,
        runningLowThreshold: z.string(),
        squareCatalogObjectId: z.string(),
        status: z.enum(['active', 'archived']),
        notes: z.string().trim(),
    }),
])

/** Cakes and take-home bags are counted exactly and must be linked to what customers order in Square. */
export const inventoryItemFormSchema = inventoryItemFormBaseSchema.superRefine((values, ctx) => {
    if (!isOrderableInventoryCategory(values.category)) return
    if (values.$trackingMode !== 'quantity') {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['$trackingMode'],
            message: 'Cakes and take-home bags are counted exactly.',
        })
    } else if (!values.squareCatalogObjectId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['squareCatalogObjectId'],
            message: 'Choose what customers order this as, so the party form can reserve it.',
        })
    }
})

export type InventoryItemFormInput = z.infer<typeof inventoryItemFormSchema>
export type InventoryItemFormValues =
    | {
          $trackingMode: 'quantity'
          name: string
          category: InventoryCategory
          baseUnit: InventoryUnit
          runningLowThreshold: number | null
          squareCatalogObjectId: string | null
          status: 'active' | 'archived'
          notes: string
      }
    | {
          $trackingMode: 'qualitative'
          name: string
          category: InventoryCategory
          baseUnit: InventoryUnit
          runningLowThreshold: null
          squareCatalogObjectId: null
          status: 'active' | 'archived'
          notes: string
      }

export const defaultInventoryItemFormValues: InventoryItemFormInput = {
    name: '',
    category: 'party-food',
    $trackingMode: 'quantity',
    baseUnit: '',
    runningLowThreshold: '',
    squareCatalogObjectId: '',
    status: 'active',
    notes: '',
}

export function inventoryItemToFormValues(item: ClientInventoryItem): InventoryItemFormInput {
    return {
        name: item.name,
        category: item.category,
        $trackingMode: item.$trackingMode,
        baseUnit: item.baseUnit ?? '',
        runningLowThreshold:
            item.$trackingMode === 'quantity' && item.runningLowThreshold !== null
                ? String(item.runningLowThreshold)
                : '',
        squareCatalogObjectId: (item.$trackingMode === 'quantity' && item.squareCatalogObjectId) || '',
        status: item.status,
        notes: item.notes ?? '',
    }
}

export function normalizeInventoryItemFormValues(values: InventoryItemFormInput): InventoryItemFormValues {
    if (values.$trackingMode === 'quantity') {
        return {
            ...values,
            runningLowThreshold: values.runningLowThreshold ? Number(values.runningLowThreshold) : null,
            // only cakes and take-home bags are ordered by customers
            squareCatalogObjectId: isOrderableInventoryCategory(values.category)
                ? values.squareCatalogObjectId || null
                : null,
        }
    }

    return { ...values, runningLowThreshold: null, squareCatalogObjectId: null }
}

export const usageRuleQuantityFormSchema = z.discriminatedUnion('$operation', [
    z.object({
        $operation: z.literal('fixed'),
        quantity: z.string().trim().min(1, { message: 'Quantity is required.' }),
    }),
    z.object({
        $operation: z.literal('per-child'),
        quantityPerChild: z.string().trim().min(1, { message: 'Per-child quantity is required.' }),
    }),
    z.object({
        $operation: z.literal('fixed-plus-per-child'),
        fixedQuantity: z.string().trim().min(1, { message: 'Fixed quantity is required.' }),
        quantityPerChild: z.string().trim().min(1, { message: 'Per-child quantity is required.' }),
    }),
])

export const usageRuleFormSchema = z
    .object({
        $type: z.enum(INVENTORY_USAGE_RULE_TYPES),
        name: z.string().trim().min(1, { message: 'Name is required.' }),
        label: z.string().trim(),
        status: z.enum(['active', 'archived']),
        quantity: usageRuleQuantityFormSchema,
        notes: z.string().trim(),
    })
    .superRefine((values, ctx) => {
        const numericFields = getUsageRuleQuantityNumericFields(values.quantity)
        numericFields.forEach(({ path, value }) => {
            const quantity = Number(value)
            const minimum = path === 'fixedQuantity' ? 0 : 1
            if (!Number.isFinite(quantity) || quantity < minimum) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['quantity', path],
                    message:
                        minimum === 0 ? 'Quantity must be zero or greater.' : 'Quantity must be greater than zero.',
                })
            }
        })
    })

export type UsageRuleFormInput = z.infer<typeof usageRuleFormSchema>
export type UsageRuleFormValues =
    | {
          $type: 'party-base'
          name: string
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'fixed'; quantity: number }
          notes: string | undefined
      }
    | {
          $type: 'party-base'
          name: string
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'per-child'; quantityPerChild: number }
          notes: string | undefined
      }
    | {
          $type: 'party-base'
          name: string
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'fixed-plus-per-child'; fixedQuantity: number; quantityPerChild: number }
          notes: string | undefined
      }
    | {
          $type: 'party-food-package'
          name: string
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'fixed'; quantity: number }
          notes: string | undefined
      }
    | {
          $type: 'party-food-package'
          name: string
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'per-child'; quantityPerChild: number }
          notes: string | undefined
      }
    | {
          $type: 'party-food-package'
          name: string
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'fixed-plus-per-child'; fixedQuantity: number; quantityPerChild: number }
          notes: string | undefined
      }
    | {
          $type: 'party-addition'
          name: Addition
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'fixed'; quantity: number }
          notes: string | undefined
      }
    | {
          $type: 'party-addition'
          name: Addition
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'per-child'; quantityPerChild: number }
          notes: string | undefined
      }
    | {
          $type: 'party-addition'
          name: Addition
          label: string | undefined
          status: 'active' | 'archived'
          quantity: { $operation: 'fixed-plus-per-child'; fixedQuantity: number; quantityPerChild: number }
          notes: string | undefined
      }

export const defaultUsageRuleFormValues: UsageRuleFormInput = {
    $type: 'party-addition',
    name: 'chickenNuggets',
    label: '',
    status: 'active',
    quantity: {
        $operation: 'fixed',
        quantity: '1',
    },
    notes: '',
}

type UsageRuleFormSource = InventoryUsageRule extends infer Rule
    ? Rule extends unknown
        ? Omit<Rule, 'createdAt' | 'updatedAt'>
        : never
    : never

export function usageRuleToFormValues(rule: UsageRuleFormSource): UsageRuleFormInput {
    const parsedKey = parseInventoryKeyParts(rule.inventoryKey)

    return {
        $type: rule.$type,
        name: rule.$type === 'party-addition' ? rule.addition : (parsedKey?.name ?? rule.inventoryKey),
        label: rule.label ?? '',
        status: rule.status,
        quantity: usageRuleQuantityToFormValues(rule.quantity),
        notes: rule.notes ?? '',
    }
}

export function normalizeUsageRuleFormValues(values: UsageRuleFormInput): UsageRuleFormValues {
    const common = {
        name: values.name.trim(),
        label: values.label || undefined,
        status: values.status,
        quantity: normalizeUsageRuleQuantity(values.quantity),
        notes: values.notes || undefined,
    }

    if (values.$type === 'party-addition') {
        return { ...common, $type: values.$type, name: values.name as Addition } as UsageRuleFormValues
    }

    return { ...common, $type: values.$type } as UsageRuleFormValues
}

function usageRuleQuantityToFormValues(ruleQuantity: InventoryUsageRule['quantity']): UsageRuleFormInput['quantity'] {
    switch (ruleQuantity.$operation) {
        case 'fixed':
            return { $operation: 'fixed', quantity: String(ruleQuantity.quantity) }
        case 'per-child':
            return { $operation: 'per-child', quantityPerChild: String(ruleQuantity.quantityPerChild) }
        case 'fixed-plus-per-child':
            return {
                $operation: 'fixed-plus-per-child',
                fixedQuantity: String(ruleQuantity.fixedQuantity),
                quantityPerChild: String(ruleQuantity.quantityPerChild),
            }
    }
}

function normalizeUsageRuleQuantity(quantity: UsageRuleFormInput['quantity']): UsageRuleFormValues['quantity'] {
    switch (quantity.$operation) {
        case 'fixed':
            return { $operation: 'fixed', quantity: Number(quantity.quantity) }
        case 'per-child':
            return { $operation: 'per-child', quantityPerChild: Number(quantity.quantityPerChild) }
        case 'fixed-plus-per-child':
            return {
                $operation: 'fixed-plus-per-child',
                fixedQuantity: Number(quantity.fixedQuantity),
                quantityPerChild: Number(quantity.quantityPerChild),
            }
    }
}

function getUsageRuleQuantityNumericFields(quantity: UsageRuleFormInput['quantity']) {
    switch (quantity.$operation) {
        case 'fixed':
            return [{ path: 'quantity', value: quantity.quantity }]
        case 'per-child':
            return [{ path: 'quantityPerChild', value: quantity.quantityPerChild }]
        case 'fixed-plus-per-child':
            return [
                { path: 'fixedQuantity', value: quantity.fixedQuantity },
                { path: 'quantityPerChild', value: quantity.quantityPerChild },
            ]
    }
}

export const stockActionFormSchema = z.object({
    quantity: z.string().trim(),
    level: z.enum(INVENTORY_QUALITATIVE_STOCK_LEVELS),
    reason: z.string().trim(),
})

export type StockActionFormInput = z.infer<typeof stockActionFormSchema>
export type StockActionFormValues = {
    quantity: number
    level: InventoryQualitativeStockLevel
    reason: string
}

export function getStockActionFormSchema(action: StockAction) {
    const currentQuantity = getCurrentQuantity(action.stock)
    const isOrderable = isOrderableInventoryItem(action.item)

    return stockActionFormSchema.superRefine((values, ctx) => {
        if (action.$type === 'level') return

        const quantity = Number(values.quantity)
        if (!values.quantity || !Number.isInteger(quantity) || quantity < 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Enter a whole number.' })
            return
        }

        if ((action.$type === 'receive' || action.$type === 'remove') && quantity === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Must be more than zero.' })
            return
        }

        if (action.$type === 'remove') {
            if (currentQuantity !== null && quantity > currentQuantity) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['quantity'],
                    message: `Only ${currentQuantity} on hand.`,
                })
            }
            if (!values.reason) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Say why it was removed.' })
            }
        }

        if (action.$type === 'count' && isOrderable && quantity !== currentQuantity && !values.reason) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['reason'],
                message: `This doesn't match the ${currentQuantity ?? 'unknown count'} on record. Say why, so the owners know what happened.`,
            })
        }
    })
}

export function getStockActionFormDefaultValues(action: StockAction): StockActionFormInput {
    return {
        // counts start empty so nobody saves the recorded number without actually counting
        quantity: '',
        level: getCurrentQualitativeLevel(action.stock),
        reason: '',
    }
}

export function normalizeStockActionFormValues(values: StockActionFormInput): StockActionFormValues {
    return {
        quantity: Number(values.quantity),
        level: values.level,
        reason: values.reason,
    }
}

export const receiveDeliveryFormSchema = z
    .object({
        quantities: z.record(z.string(), z.string().trim()),
        note: z.string().trim(),
        checked: z.boolean(),
    })
    .superRefine((values, ctx) => {
        const entries = Object.entries(values.quantities).filter(([, quantity]) => quantity !== '')
        entries.forEach(([itemId, quantity]) => {
            const value = Number(quantity)
            if (!Number.isInteger(value) || value < 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantities', itemId], message: 'Whole number' })
            }
        })
        if (!entries.some(([, quantity]) => Number(quantity) > 0)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Enter at least one quantity.' })
        }
        if (!values.checked) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['checked'],
                message: 'Physically check the delivery before receiving it.',
            })
        }
    })

export type ReceiveDeliveryFormInput = z.infer<typeof receiveDeliveryFormSchema>

export function getReceiveDeliveryLines(values: ReceiveDeliveryFormInput) {
    return Object.entries(values.quantities)
        .map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) }))
        .filter((line) => line.quantity > 0)
}

export type CountAllFormInput = { quantities: Record<string, string>; reason: string }

/**
 * Counting every cake and bag at once. Blank rows weren't counted and are left alone. If any count differs from the
 * record, one reason covers the whole count.
 */
export function getCountAllFormSchema(recordedQuantities: Map<string, number | null>) {
    return z
        .object({ quantities: z.record(z.string(), z.string().trim()), reason: z.string().trim() })
        .superRefine((values, ctx) => {
            const counted = Object.entries(values.quantities).filter(([, quantity]) => quantity !== '')
            counted.forEach(([itemId, quantity]) => {
                const value = Number(quantity)
                if (!Number.isInteger(value) || value < 0) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantities', itemId], message: 'Whole number' })
                }
            })
            if (counted.length === 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Enter at least one count.' })
                return
            }
            const hasMismatch = counted.some(
                ([itemId, quantity]) => Number(quantity) !== recordedQuantities.get(itemId)
            )
            if (hasMismatch && !values.reason) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['reason'],
                    message: "Some counts don't match the record. Say why, so the owners know what happened.",
                })
            }
        })
}

export function getCountAllLines(values: CountAllFormInput) {
    return Object.entries(values.quantities)
        .filter(([, quantity]) => quantity !== '')
        .map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) }))
}
