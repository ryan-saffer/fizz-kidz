import { ADDITIONS, getInventoryUsageRuleInventoryKey, assertNever } from '@fizz-kidz/core'
import type { InventoryUsageRule, InventoryUsageRuleQuantity } from '@fizz-kidz/core'

import type { inventoryUsageRuleInputSchema } from './inventory.schemas'
import type { z } from 'zod'

export type InventoryUsageRuleInput = z.infer<typeof inventoryUsageRuleInputSchema>

export function buildInventoryUsageRule(input: InventoryUsageRuleInput, options: { id: string; now: Date }) {
    const inventoryKey = getInventoryUsageRuleInventoryKey(input.$type, input.name)
    const common = {
        id: options.id,
        inventoryKey,
        label: input.label || getDefaultInventoryUsageRuleLabel(input),
        status: input.status,
        quantity: input.quantity,
        notes: input.notes,
        createdAt: options.now,
        updatedAt: options.now,
    }

    if (input.$type === 'party-addition') {
        return {
            ...common,
            $type: 'party-addition',
            addition: input.name,
        } satisfies InventoryUsageRule
    }

    return {
        ...common,
        $type: input.$type,
    } satisfies InventoryUsageRule
}

function getDefaultInventoryUsageRuleLabel(input: InventoryUsageRuleInput) {
    if (input.$type === 'party-addition') {
        return ADDITIONS[input.name].displayValue
    }

    return input.name
}

export function formatInventoryUsageRuleQuantity(quantity: InventoryUsageRuleQuantity) {
    switch (quantity.$operation) {
        case 'fixed':
            return `${quantity.quantity} per booking`
        case 'per-child':
            return `${quantity.quantityPerChild} per child`
        case 'fixed-plus-per-child':
            return `${quantity.fixedQuantity} per booking + ${quantity.quantityPerChild} per child`
        default:
            assertNever(quantity)
            throw new Error(`Unhandled quantity.$operation: ${JSON.stringify(quantity)}`)
    }
}
