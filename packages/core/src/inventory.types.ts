import type { Studio } from './core/studio'
import type {
    INVENTORY_CATEGORIES,
    INVENTORY_QUALITATIVE_STOCK_LEVELS,
    INVENTORY_STOCK_MOVEMENT_SOURCES,
    INVENTORY_UNITS,
    INVENTORY_USAGE_RULE_TYPES,
} from './inventory'
import type { Addition } from './parties/additions'

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]
export type InventoryUnit = (typeof INVENTORY_UNITS)[number]
export type InventoryQualitativeStockLevel = (typeof INVENTORY_QUALITATIVE_STOCK_LEVELS)[number]
export type InventoryStockMovementSource = (typeof INVENTORY_STOCK_MOVEMENT_SOURCES)[number]
export type InventoryUsageRuleType = (typeof INVENTORY_USAGE_RULE_TYPES)[number]

export type InventoryLocation = Studio

export type InventoryPurchaseOption = {
    label: string
    unit: InventoryUnit
    quantityInBaseUnits: number
    supplier?: string
}

export type BaseInventoryItem = {
    id: string
    name: string
    inventoryKey?: string
    category: InventoryCategory
    status: 'active' | 'archived'
    purchaseOptions?: InventoryPurchaseOption[]
    notes?: string
    createdAt: Date
    updatedAt: Date
}

export type QuantityTrackedInventoryItem = BaseInventoryItem & {
    $trackingMode: 'quantity'
    baseUnit: InventoryUnit
    /** Count at or below this value should be shown as running low. `null` disables the badge. */
    runningLowThreshold: number | null
    /** Shopping lists buy enough to cover selected bookings and still leave at least this quantity on hand. `null` disables the buffer. */
    minimumTargetQuantity?: number | null
}

export type QualitativeInventoryItem = BaseInventoryItem & {
    $trackingMode: 'qualitative'
    baseUnit?: InventoryUnit
}

export type InventoryItem = QuantityTrackedInventoryItem | QualitativeInventoryItem

export type InventoryStockMeasurement =
    | {
          $type: 'quantity'
          /**
           * Exact count for this item at this location. `null` means the count is unknown
           * and someone needs to count it; it is not the same as being out of stock.
           */
          quantity: number | null
      }
    | {
          $type: 'qualitative'
          level: InventoryQualitativeStockLevel
      }

export type InventoryStockLevel = {
    id: string
    itemId: string
    location: InventoryLocation
    /**
     * Whether this studio uses/tracks this item. `false` means the item is unused at this studio,
     * not that the studio has run out of stock. Out-of-stock quantity items use quantity `0`,
     * unknown quantity items use quantity `null`, and qualitative items use measurement level `out`.
     */
    stocked: boolean
    measurement: InventoryStockMeasurement
    reorderPoint?: number
    parLevel?: number
    reorderLevel?: InventoryQualitativeStockLevel
    targetLevel?: InventoryQualitativeStockLevel
    lastMovementAt?: Date
    updatedAt: Date
}

export type InventoryStockMovementAdjustment =
    | {
          $type: 'quantity'
          $operation: 'adjust'
          delta: number
          quantityBefore: number
          quantityAfter: number
      }
    | {
          $type: 'quantity'
          $operation: 'set'
          quantityBefore: number | null
          quantityAfter: number | null
      }
    | {
          $type: 'qualitative'
          levelBefore: InventoryQualitativeStockLevel
          levelAfter: InventoryQualitativeStockLevel
      }

export type InventoryStockMovement = {
    id: string
    itemId: string
    location: InventoryLocation
    source: InventoryStockMovementSource
    adjustment: InventoryStockMovementAdjustment
    reason?: string
    createdAt: Date
    createdBy: {
        uid: string
        email: string
    }
}

export type InventoryUsageRuleQuantity =
    | {
          $operation: 'fixed'
          quantity: number
      }
    | {
          $operation: 'per-child'
          quantityPerChild: number
      }
    | {
          $operation: 'fixed-plus-per-child'
          fixedQuantity: number
          quantityPerChild: number
      }

type BaseInventoryUsageRule = {
    id: string
    inventoryKey: string
    label?: string
    status: 'active' | 'archived'
    quantity: InventoryUsageRuleQuantity
    notes?: string
    createdAt: Date
    updatedAt: Date
}

export type InventoryUsageRule =
    | (BaseInventoryUsageRule & {
          $type: Extract<InventoryUsageRuleType, 'party-base'>
      })
    | (BaseInventoryUsageRule & {
          $type: Extract<InventoryUsageRuleType, 'party-food-package'>
      })
    | (BaseInventoryUsageRule & {
          $type: Extract<InventoryUsageRuleType, 'party-addition'>
          addition: Addition
      })

export type InventoryShoppingListSourceBreakdown = {
    ruleId: string
    label: string
    requiredQuantity: number
    bookingCount: number
}

export type InventoryShoppingListLine = {
    itemId: string
    inventoryKey: string
    itemName: string
    category: InventoryCategory
    baseUnit: InventoryUnit
    location: InventoryLocation
    requiredQuantity: number
    quantityOnHand: number | null
    minimumTargetQuantity: number
    suggestedPurchaseQuantity: number | null
    stocked: boolean
    sourceBreakdown: InventoryShoppingListSourceBreakdown[]
}

export type InventoryShoppingListWarning =
    | {
          $type: 'no-active-rules'
          message: string
      }
    | {
          $type: 'invalid-child-count'
          bookingId: string
          location: InventoryLocation
          bookingLabel: string
          value?: string
      }
    | {
          $type: 'missing-inventory-item'
          location: InventoryLocation
          inventoryKey: string
          requiredQuantity: number
      }
    | {
          $type: 'duplicate-inventory-items'
          location: InventoryLocation
          inventoryKey: string
          itemIds: string[]
          itemNames: string[]
      }
    | {
          $type: 'qualitative-item-required'
          location: InventoryLocation
          inventoryKey: string
          itemId: string
          itemName: string
          requiredQuantity: number
          level?: InventoryQualitativeStockLevel
      }
    | {
          $type: 'missing-stock-level'
          location: InventoryLocation
          inventoryKey: string
          itemId: string
          itemName: string
          requiredQuantity: number
      }
    | {
          $type: 'unused-at-location'
          location: InventoryLocation
          inventoryKey: string
          itemId: string
          itemName: string
          requiredQuantity: number
      }
    | {
          $type: 'unknown-stock-quantity'
          location: InventoryLocation
          inventoryKey: string
          itemId: string
          itemName: string
          requiredQuantity: number
      }

export type InventoryShoppingListStudioReport = {
    location: InventoryLocation
    bookingCount: number
    lines: InventoryShoppingListLine[]
    warnings: InventoryShoppingListWarning[]
}

export type InventoryShoppingList = {
    startDate: Date
    endDate: Date
    generatedAt: Date
    bookingCount: number
    studioReports: InventoryShoppingListStudioReport[]
    warnings: InventoryShoppingListWarning[]
}
