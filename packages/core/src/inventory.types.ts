import type { Studio } from './core/studio'
import type { INVENTORY_CATEGORIES, INVENTORY_QUALITATIVE_STOCK_LEVELS, INVENTORY_USAGE_RULE_TYPES } from './inventory'
import type { Addition } from './parties/additions'

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]
/** What an item is counted in, typed by staff in the singular, eg. 'cake', 'bag', 'pack' or 'kg'. */
export type InventoryUnit = string
export type InventoryQualitativeStockLevel = (typeof INVENTORY_QUALITATIVE_STOCK_LEVELS)[number]
export type InventoryUsageRuleType = (typeof INVENTORY_USAGE_RULE_TYPES)[number]

export type InventoryLocation = Studio

export type BaseInventoryItem = {
    id: string
    name: string
    inventoryKey?: string
    category: InventoryCategory
    status: 'active' | 'archived'
    notes?: string
    createdAt: Date
    updatedAt: Date
}

export type QuantityTrackedInventoryItem = BaseInventoryItem & {
    $trackingMode: 'quantity'
    baseUnit: InventoryUnit
    /**
     * At or below this value the item is running low and needs reordering. Orderable items compare their
     * available (unreserved) quantity. `null` disables it.
     */
    runningLowThreshold: number | null
    /**
     * The Square catalog object customers order this item as (a cake design modifier or a take-home bag
     * variation). Linked items are orderable: party form orders reserve them for the booking.
     */
    squareCatalogObjectId?: string
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
    /** Physical stock. For quantity items this includes stock reserved for bookings. */
    measurement: InventoryStockMeasurement
    /** Orderable items only: how much of the quantity on hand is reserved for upcoming bookings. */
    reservedQuantity?: number
    lastMovementAt?: Date
    updatedAt: Date
}

export type InventoryActor = { $type: 'staff'; uid: string; email: string } | { $type: 'system' }

type BaseInventoryStockMovement = {
    id: string
    itemId: string
    location: InventoryLocation
    reason?: string
    createdAt: Date
    createdBy: InventoryActor
}

/**
 * The stock history. Every change to a stock level writes exactly one movement in the same transaction.
 * Reservation movements carry the booking they were made for.
 */
export type InventoryStockMovement = BaseInventoryStockMovement &
    (
        | {
              /** A delivery was physically checked and added. */
              $type: 'received'
              quantity: number
              quantityBefore: number
              quantityAfter: number
          }
        | {
              /** Someone counted the stock. `null` marks the count unknown. */
              $type: 'counted'
              quantityBefore: number | null
              quantityAfter: number | null
          }
        | {
              /** Stock thrown out, damaged or otherwise taken out by staff. */
              $type: 'removed'
              quantity: number
              quantityBefore: number
              quantityAfter: number
          }
        | {
              $type: 'level-updated'
              levelBefore: InventoryQualitativeStockLevel
              levelAfter: InventoryQualitativeStockLevel
          }
        | {
              /** A customer ordered it for a booking. It stays on hand until the party. */
              $type: 'reserved'
              bookingId: string
              quantity: number
              reservedBefore: number
              reservedAfter: number
          }
        | {
              /** A reservation was given back, eg. the booking was cancelled or payment failed. */
              $type: 'released'
              bookingId: string
              quantity: number
              reservedBefore: number
              reservedAfter: number
          }
        | {
              /** The party happened, so the reserved stock left the studio. */
              $type: 'used'
              bookingId: string
              quantity: number
              quantityBefore: number
              quantityAfter: number
              reservedBefore: number
              reservedAfter: number
          }
    )

export type InventoryStockMovementType = InventoryStockMovement['$type']

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
