import type { Studio } from './core/studio'
import type {
    InventoryCategory,
    InventoryItem,
    InventoryStockLevel,
    InventoryUsageRuleType,
    QuantityTrackedInventoryItem,
} from './inventory.types'

/** Inventory only tracks food: party food, plus the cakes and take-home bags sold from studio stock. */
export const INVENTORY_CATEGORIES = ['party-food', 'cakes', 'take-home-bags'] as const

export const INVENTORY_QUALITATIVE_STOCK_LEVELS = ['unknown', 'out', 'low', 'medium', 'high'] as const

export const INVENTORY_USAGE_RULE_TYPES = ['party-base', 'party-food-package', 'party-addition'] as const

export function getInventoryStockLevelId(location: Studio, itemId: string) {
    return `${location}_${itemId}`
}

/** Categories customers order from studio stock. Their items must be linked to what they order in Square. */
export const INVENTORY_ORDERABLE_CATEGORIES = ['cakes', 'take-home-bags'] as const satisfies InventoryCategory[]

export function isOrderableInventoryCategory(category: InventoryCategory) {
    return (INVENTORY_ORDERABLE_CATEGORIES as readonly InventoryCategory[]).includes(category)
}

type StockLevelQuantity = Pick<InventoryStockLevel, 'measurement' | 'reservedQuantity'>

export function isOrderableInventoryItem<T extends Pick<InventoryItem, '$trackingMode'>>(
    item: T
): item is T & { $trackingMode: 'quantity'; squareCatalogObjectId: string } {
    return item.$trackingMode === 'quantity' && !!(item as Partial<QuantityTrackedInventoryItem>).squareCatalogObjectId
}

/** Stock that is on hand and not reserved for a booking. `null` when the count is unknown. */
export function getInventoryAvailableQuantity(stockLevel: StockLevelQuantity | undefined) {
    if (stockLevel?.measurement.$type !== 'quantity' || stockLevel.measurement.quantity === null) return null

    return stockLevel.measurement.quantity - (stockLevel.reservedQuantity ?? 0)
}

/**
 * Running low means it's time to reorder. Orderable items compare what customers can still order (available),
 * everything else compares what is on hand.
 */
export function getIsInventoryRunningLow(
    item: Pick<InventoryItem, '$trackingMode'> & Partial<Pick<QuantityTrackedInventoryItem, 'runningLowThreshold'>>,
    stockLevel: StockLevelQuantity | undefined
) {
    if (item.$trackingMode === 'qualitative') {
        return stockLevel?.measurement.$type === 'qualitative' && ['low', 'out'].includes(stockLevel.measurement.level)
    }

    const quantity = isOrderableInventoryItem(item)
        ? getInventoryAvailableQuantity(stockLevel)
        : stockLevel?.measurement.$type === 'quantity'
          ? stockLevel.measurement.quantity
          : null
    if (item.runningLowThreshold == null || quantity === null) return false

    return quantity <= item.runningLowThreshold
}

export function getInventoryUsageRuleInventoryKey(type: InventoryUsageRuleType, name: string) {
    return `${type}:${name.trim()}`
}

export function parseInventoryUsageRuleInventoryKey(inventoryKey: string | undefined) {
    if (!inventoryKey) return undefined

    const separatorIndex = inventoryKey.indexOf(':')
    if (separatorIndex === -1) return undefined

    const type = inventoryKey.slice(0, separatorIndex)
    const name = inventoryKey.slice(separatorIndex + 1)
    if (!INVENTORY_USAGE_RULE_TYPES.includes(type as InventoryUsageRuleType) || !name) return undefined

    return { $type: type as InventoryUsageRuleType, name }
}

export type * from './inventory.types'
