import type { InventoryItem, InventoryStockLevel, InventoryUsageRule } from '@fizz-kidz/core'

export type TrackingMode = InventoryItem['$trackingMode']

type ClientDates<T> = T extends unknown
    ? Omit<T, 'createdAt' | 'updatedAt'> & {
          createdAt: string | Date
          updatedAt: string | Date
      }
    : never

export type ClientInventoryItem = ClientDates<InventoryItem>

export type ClientInventoryStockLevel = Omit<InventoryStockLevel, 'lastMovementAt' | 'updatedAt'> & {
    lastMovementAt?: string | Date
    updatedAt: string | Date
}

export type ClientInventoryUsageRule = ClientDates<InventoryUsageRule>

export type SearchableInventoryItem = {
    item: ClientInventoryItem
    name: string
    category: string
    rawCategory: string
    notes: string
    unit: string
    tracking: string
    status: string
}

export type StockActionType = 'receive' | 'count' | 'remove' | 'level'

export type StockAction = {
    $type: StockActionType
    item: ClientInventoryItem
    stock?: ClientInventoryStockLevel
}

export type StockStatusFilter = 'all' | 'running-low' | 'needs-count' | 'not-running-low'
