import { useQuery } from '@tanstack/react-query'
import { useDeferredValue } from 'react'

import { isOrderableInventoryItem } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'

import { useInventoryStore } from '../state/inventory-store'
import { ALL_CATEGORIES } from '../utils/inventory.constants'
import {
    getIsRunningLow,
    getNeedsCount,
    getStockStatusFilteredItems,
    getVisibleInventoryItems,
} from '../utils/inventory.utils'
import { useInventoryLocation } from './use-inventory-location'

import type { ClientInventoryStockLevel } from '../utils/inventory.types'

export function useInventoryData() {
    const trpc = useTRPC()
    const { availableLocations, canChooseLocation, location } = useInventoryLocation()
    const categoryFilter = useInventoryStore((state) => state.categoryFilter)
    const stockStatusFilter = useInventoryStore((state) => state.stockStatusFilter)
    const search = useInventoryStore((state) => state.search)
    const deferredSearch = useDeferredValue(search)
    const searchQuery = deferredSearch.trim()

    // every item is loaded and the category filtered here, so receiving a delivery always lists every orderable item
    const itemsQuery = useQuery(trpc.inventory.listItems.queryOptions({ includeArchived: true }))
    const stockQuery = useQuery(trpc.inventory.listStock.queryOptions({ location }))

    const stockByItemId = new Map<string, ClientInventoryStockLevel>(
        (stockQuery.data ?? []).map((stock) => [stock.itemId, stock])
    )
    const inventoryItems = (itemsQuery.data ?? []).sort((a, b) => a.name.localeCompare(b.name))
    const categoryItems =
        categoryFilter === ALL_CATEGORIES
            ? inventoryItems
            : inventoryItems.filter((item) => item.category === categoryFilter)
    const searchedItems = getVisibleInventoryItems(categoryItems, searchQuery)
    const activeTrackedItems = searchedItems.filter((item) => {
        const stock = stockByItemId.get(item.id)
        return item.status === 'active' && stock?.stocked
    })
    const runningLowItemCount = activeTrackedItems.filter((item) =>
        getIsRunningLow(item, stockByItemId.get(item.id))
    ).length
    const needsCountItemCount = activeTrackedItems.filter((item) =>
        getNeedsCount(item, stockByItemId.get(item.id))
    ).length
    const notRunningLowItemCount = activeTrackedItems.filter((item) => {
        const stock = stockByItemId.get(item.id)
        return !getIsRunningLow(item, stock) && !getNeedsCount(item, stock)
    }).length
    const items = getStockStatusFilteredItems(searchedItems, stockByItemId, stockStatusFilter)
    const trackedItems = items.filter((item) => item.status === 'active' && stockByItemId.get(item.id)?.stocked)

    return {
        activeTrackedCount: activeTrackedItems.length,
        availableLocations,
        canChooseLocation,
        hiddenItems: items.filter((item) => item.status === 'archived' || !stockByItemId.get(item.id)?.stocked),
        isLoading: itemsQuery.isPending || stockQuery.isPending,
        itemCount: itemsQuery.data?.length ?? 0,
        location,
        needsCountItemCount,
        notRunningLowItemCount,
        runningLowItemCount,
        shownItemCount: items.length,
        stockByItemId,
        /** Cakes and take-home bags customers order from this studio's stock. */
        orderableItems: trackedItems.filter((item) => isOrderableInventoryItem(item)),
        supplyItems: trackedItems.filter((item) => !isOrderableInventoryItem(item)),
        /** Every orderable item tracked here, ignoring filters, for receiving a delivery. */
        receivableItems: inventoryItems.filter(
            (item) => isOrderableInventoryItem(item) && item.status === 'active' && stockByItemId.get(item.id)?.stocked
        ),
        trackedStockCount: (stockQuery.data ?? []).filter((stock) => stock.stocked).length,
    }
}
