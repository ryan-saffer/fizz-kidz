import type { Studio } from './core/studio'
import type {
    InventoryCakeSupplyUse,
    InventoryCategory,
    InventoryItem,
    InventoryStockLevel,
    InventoryUsageRuleType,
    QuantityTrackedInventoryItem,
} from './inventory.types'

/** Inventory only tracks food: party food, plus the cakes and take-home bags sold from studio stock. */
export const INVENTORY_CATEGORIES = ['party-food', 'cakes', 'cake-supplies', 'take-home-bags'] as const

export const INVENTORY_QUALITATIVE_STOCK_LEVELS = ['unknown', 'out', 'low', 'medium', 'high'] as const

export const INVENTORY_USAGE_RULE_TYPES = ['party-base', 'party-food-package', 'party-addition'] as const

export function getInventoryStockLevelId(location: Studio, itemId: string) {
    return `${location}_${itemId}`
}

/**
 * Categories sold from studio stock at Geelong and Werribee. Their items must be linked to what parents order in
 * Square: a cake design or take-home bag, or for cake supplies the serving or candle option that uses them.
 */
export const INVENTORY_LINKED_CATEGORIES = [
    'cakes',
    'cake-supplies',
    'take-home-bags',
] as const satisfies InventoryCategory[]

/** Linked categories parents order directly, which are reserved for the booking and can sell out. */
export const INVENTORY_ORDERABLE_CATEGORIES = ['cakes', 'take-home-bags'] as const satisfies InventoryCategory[]

export function isLinkedInventoryCategory(category: InventoryCategory) {
    return (INVENTORY_LINKED_CATEGORIES as readonly InventoryCategory[]).includes(category)
}

export function isOrderableInventoryCategory(category: InventoryCategory) {
    return (INVENTORY_ORDERABLE_CATEGORIES as readonly InventoryCategory[]).includes(category)
}

/** Cups and spoons used per child at a party, rounded up: enough for the kids plus spares for parents and spills. */
export const CAKE_SUPPLIES_PER_CHILD = 1.5

/** How much of a cake supply a party uses: one per party (eg. a pack of candles) or per child (cups, spoons). */
export function getCakeSupplyQuantity(usedPer: InventoryCakeSupplyUse, children: number) {
    return usedPer === 'party' ? 1 : Math.ceil(children * CAKE_SUPPLIES_PER_CHILD)
}

type StockLevelQuantity = Pick<InventoryStockLevel, 'measurement' | 'reservedQuantity'>

type LinkableItem = Pick<InventoryItem, '$trackingMode' | 'category'>

/** An item sold from studio stock and linked to Square (cakes, cake supplies, take-home bags). It always has a count. */
export function isLinkedInventoryItem<T extends LinkableItem>(
    item: T
): item is T & { $trackingMode: 'quantity'; squareCatalogObjectId: string } {
    return (
        item.$trackingMode === 'quantity' &&
        isLinkedInventoryCategory(item.category) &&
        !!(item as Partial<QuantityTrackedInventoryItem>).squareCatalogObjectId
    )
}

/** A linked item parents order directly (cakes, take-home bags): reserved when ordered, so it has an available count. */
export function isOrderableInventoryItem<T extends LinkableItem>(
    item: T
): item is T & { $trackingMode: 'quantity'; squareCatalogObjectId: string } {
    return isLinkedInventoryItem(item) && isOrderableInventoryCategory(item.category)
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
    item: LinkableItem & Partial<Pick<QuantityTrackedInventoryItem, 'runningLowThreshold'>>,
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
