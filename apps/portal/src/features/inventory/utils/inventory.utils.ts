import Fuse from 'fuse.js'

import { STUDIOS, capitalise, getIsInventoryRunningLow } from '@fizz-kidz/core'
import type {
    InventoryCategory,
    InventoryQualitativeStockLevel,
    InventoryUnit,
    Studio,
    StudioOrMaster,
} from '@fizz-kidz/core'

import { getOrgName } from '@shared/lib/studio-utils'

import type {
    ClientInventoryItem,
    ClientInventoryStockLevel,
    SearchableInventoryItem,
    StockAction,
    StockStatusFilter,
} from './inventory.types'

export function getAvailableInventoryLocations(currentOrg: StudioOrMaster | null) {
    if (currentOrg === 'master') {
        return [...STUDIOS]
    }

    return currentOrg ? [currentOrg] : [...STUDIOS]
}

export function getIsRunningLow(item: ClientInventoryItem, stock?: ClientInventoryStockLevel) {
    return getIsInventoryRunningLow(item, stock)
}

export function getNeedsCount(item: ClientInventoryItem, stock?: ClientInventoryStockLevel) {
    return (
        item.$trackingMode === 'quantity' &&
        stock?.measurement.$type === 'quantity' &&
        stock.measurement.quantity === null
    )
}

export function getStockStatusFilteredItems(
    items: ClientInventoryItem[],
    stockByItemId: Map<string, ClientInventoryStockLevel>,
    filter: StockStatusFilter
) {
    if (filter === 'all') return items

    return items.filter((item) => {
        const stock = stockByItemId.get(item.id)
        if (item.status !== 'active' || !stock?.stocked) return false

        if (filter === 'running-low') return getIsRunningLow(item, stock)
        if (filter === 'needs-count') return getNeedsCount(item, stock)
        return !getIsRunningLow(item, stock) && !getNeedsCount(item, stock)
    })
}

export function getVisibleInventoryItems(items: ClientInventoryItem[], searchQuery: string) {
    if (!searchQuery) return items

    const searchableItems: SearchableInventoryItem[] = items.map((item) => ({
        item,
        name: item.name,
        category: formatCategory(item.category),
        rawCategory: item.category,
        notes: item.notes ?? '',
        unit: item.baseUnit ? formatUnit(item.baseUnit) : '',
        tracking: item.$trackingMode === 'quantity' ? 'exact quantity count' : 'high medium low qualitative',
        status: item.status,
    }))
    const fuse = new Fuse<SearchableInventoryItem>(searchableItems, {
        keys: [
            { name: 'name', weight: 0.55 },
            { name: 'category', weight: 0.15 },
            { name: 'rawCategory', weight: 0.1 },
            { name: 'notes', weight: 0.1 },
            { name: 'unit', weight: 0.05 },
            { name: 'tracking', weight: 0.03 },
            { name: 'status', weight: 0.02 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
    })

    return fuse.search(searchQuery).map(({ item }) => item.item)
}

export function getCurrentQuantity(stock?: ClientInventoryStockLevel) {
    if (stock?.measurement.$type !== 'quantity') {
        return null
    }

    return stock.measurement.quantity
}

export function getCurrentQualitativeLevel(stock?: ClientInventoryStockLevel): InventoryQualitativeStockLevel {
    if (stock?.measurement.$type !== 'qualitative') {
        return 'unknown'
    }

    return stock.measurement.level
}

export function getStockActionTitle(action: StockAction) {
    switch (action.$type) {
        case 'receive':
            return `Receive ${action.item.name}`
        case 'count':
            return `Count ${action.item.name}`
        case 'remove':
            return `Remove ${action.item.name}`
        case 'level':
            return `Update level for ${action.item.name}`
    }
}

export function getStockActionDescription(action: StockAction, location: Studio) {
    switch (action.$type) {
        case 'receive':
            return `Add stock that has arrived at ${getOrgName(location)}.`
        case 'count':
            return `Enter what is physically at ${getOrgName(location)} right now.`
        case 'remove':
            return `Take out stock that was thrown out, damaged or otherwise left ${getOrgName(location)}.`
        case 'level':
            return `Set the current high, medium, low, or out level at ${getOrgName(location)}.`
    }
}

export function getStockActionSubmitLabel(action: StockAction) {
    switch (action.$type) {
        case 'receive':
            return 'Receive stock'
        case 'count':
            return 'Save count'
        case 'remove':
            return 'Remove stock'
        case 'level':
            return 'Update level'
    }
}

export function formatCategory(category: InventoryCategory) {
    return category
        .split('-')
        .map((part) => capitalise(part))
        .join(' ')
}

const MEASURES = ['kg', 'g', 'l', 'ml']

export function formatUnit(unit: InventoryUnit) {
    return MEASURES.includes(unit) ? unit : capitalise(unit)
}

/** Units are typed by staff in the singular, so plurals are a best guess (bag → bags, box → boxes, kg → kg). */
export function formatQuantityUnit(unit: InventoryUnit | undefined, quantity: number) {
    const name = unit?.trim().toLowerCase()
    if (!name || name === 'each') return quantity === 1 ? 'unit' : 'units'
    if (quantity === 1 || MEASURES.includes(name) || name.endsWith('s')) return name
    return /(x|ch|sh)$/.test(name) ? `${name}es` : `${name}s`
}

export function formatQualitativeLevel(level: InventoryQualitativeStockLevel) {
    return level === 'out' ? 'Out' : capitalise(level)
}

export function pluraliseItem(count: number) {
    return count === 1 ? 'item' : 'items'
}
