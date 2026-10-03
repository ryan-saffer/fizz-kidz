import { describe, expect, it, vi } from 'vite-plus/test'

import {
    formatCategory,
    formatQualitativeLevel,
    formatQuantityUnit,
    formatUnit,
    getAvailableInventoryLocations,
    getCurrentQualitativeLevel,
    getCurrentQuantity,
    getIsRunningLow,
    getNeedsCount,
    getStockActionDescription,
    getStockActionSubmitLabel,
    getStockActionTitle,
    getStockStatusFilteredItems,
    getVisibleInventoryItems,
    pluraliseItem,
} from './inventory.utils'

import type { ClientInventoryItem, ClientInventoryStockLevel, StockAction } from './inventory.types'

vi.mock('@shared/lib/studio-utils', () => ({
    getOrgName: (studio: string) => `${studio} studio`,
}))

const quantityItem: ClientInventoryItem = {
    id: 'quantity',
    name: 'Party pies',
    inventoryKey: 'party-base:partyPies',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'quantity',
    baseUnit: 'each',
    runningLowThreshold: 10,
    notes: 'Frozen food',
    createdAt: new Date(),
    updatedAt: new Date(),
}

const qualitativeItem: ClientInventoryItem = {
    id: 'qualitative',
    name: 'Glitter',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'qualitative',
    baseUnit: 'tub',
    createdAt: new Date(),
    updatedAt: new Date(),
}

const quantityStock = (
    quantity: number | null,
    overrides: Partial<ClientInventoryStockLevel> = {}
): ClientInventoryStockLevel => ({
    id: 'balwyn_quantity',
    itemId: 'quantity',
    location: 'balwyn',
    stocked: true,
    measurement: { $type: 'quantity', quantity },
    updatedAt: new Date(),
    ...overrides,
})

const qualitativeStock = (level: 'unknown' | 'out' | 'low' | 'medium' | 'high'): ClientInventoryStockLevel => ({
    id: 'balwyn_qualitative',
    itemId: 'qualitative',
    location: 'balwyn',
    stocked: true,
    measurement: { $type: 'qualitative', level },
    updatedAt: new Date(),
})

describe('inventory utils', () => {
    it('returns available locations from current organisation', () => {
        expect(getAvailableInventoryLocations('master').length).toBeGreaterThan(1)
        expect(getAvailableInventoryLocations('balwyn')).toEqual(['balwyn'])
        expect(getAvailableInventoryLocations(null).length).toBeGreaterThan(1)
    })

    it('detects running-low and needs-count stock states', () => {
        expect(getIsRunningLow(quantityItem, quantityStock(10))).toBe(true)
        expect(getIsRunningLow(quantityItem, quantityStock(11))).toBe(false)
        expect(getIsRunningLow({ ...quantityItem, runningLowThreshold: null }, quantityStock(0))).toBe(false)
        expect(getIsRunningLow(qualitativeItem, qualitativeStock('low'))).toBe(true)
        expect(getIsRunningLow(qualitativeItem, qualitativeStock('out'))).toBe(true)
        expect(getIsRunningLow(qualitativeItem, qualitativeStock('medium'))).toBe(false)
        expect(
            getIsRunningLow(
                { ...quantityItem, squareCatalogObjectId: 'square-cake', runningLowThreshold: 2 },
                quantityStock(5, { reservedQuantity: 3 })
            )
        ).toBe(true)
        expect(
            getIsRunningLow({ ...quantityItem, runningLowThreshold: 2 }, quantityStock(5, { reservedQuantity: 3 }))
        ).toBe(false)
        expect(getNeedsCount(quantityItem, quantityStock(null))).toBe(true)
        expect(getNeedsCount(quantityItem, quantityStock(1))).toBe(false)
        expect(getNeedsCount(qualitativeItem, qualitativeStock('unknown'))).toBe(false)
    })

    it('filters stock status for active stocked items only', () => {
        const okItem = { ...quantityItem, id: 'ok' }
        const lowItem = { ...quantityItem, id: 'low' }
        const countItem = { ...quantityItem, id: 'count' }
        const hiddenItem = { ...quantityItem, id: 'hidden', status: 'archived' as const }
        const stockByItemId = new Map([
            ['ok', quantityStock(20, { itemId: 'ok' })],
            ['low', quantityStock(1, { itemId: 'low' })],
            ['count', quantityStock(null, { itemId: 'count' })],
            ['hidden', quantityStock(0, { itemId: 'hidden' })],
        ])

        expect(
            getStockStatusFilteredItems([okItem, lowItem, countItem, hiddenItem], stockByItemId, 'all')
        ).toHaveLength(4)
        expect(
            getStockStatusFilteredItems([okItem, lowItem, countItem, hiddenItem], stockByItemId, 'running-low')
        ).toEqual([lowItem])
        expect(
            getStockStatusFilteredItems([okItem, lowItem, countItem, hiddenItem], stockByItemId, 'needs-count')
        ).toEqual([countItem])
        expect(
            getStockStatusFilteredItems([okItem, lowItem, countItem, hiddenItem], stockByItemId, 'not-running-low')
        ).toEqual([okItem])
    })

    it('searches visible items across display fields', () => {
        expect(getVisibleInventoryItems([quantityItem, qualitativeItem], '')).toEqual([quantityItem, qualitativeItem])
        expect(getVisibleInventoryItems([quantityItem, qualitativeItem], 'frozen')).toEqual([quantityItem])
        expect(getVisibleInventoryItems([quantityItem, qualitativeItem], 'qualitative')).toEqual([qualitativeItem])
    })

    it('formats stock action text and stock values', () => {
        const receive: StockAction = { $type: 'receive', item: quantityItem, stock: quantityStock(2) }
        const count: StockAction = { $type: 'count', item: quantityItem, stock: quantityStock(2) }
        const remove: StockAction = { $type: 'remove', item: quantityItem, stock: quantityStock(2) }
        const level: StockAction = { $type: 'level', item: qualitativeItem, stock: qualitativeStock('medium') }

        expect(getStockActionTitle(receive)).toBe('Receive Party pies')
        expect(getStockActionTitle(count)).toBe('Count Party pies')
        expect(getStockActionTitle(remove)).toBe('Remove Party pies')
        expect(getStockActionTitle(level)).toBe('Update level for Glitter')
        expect(getStockActionDescription(receive, 'balwyn')).toContain('balwyn studio')
        expect(getStockActionDescription(count, 'balwyn')).toContain('physically at balwyn studio')
        expect(getStockActionDescription(remove, 'balwyn')).toContain('thrown out')
        expect(getStockActionDescription(level, 'balwyn')).toContain('high, medium, low')
        expect(getStockActionSubmitLabel(receive)).toBe('Receive stock')
        expect(getStockActionSubmitLabel(count)).toBe('Save count')
        expect(getStockActionSubmitLabel(remove)).toBe('Remove stock')
        expect(getStockActionSubmitLabel(level)).toBe('Update level')
        expect(getCurrentQuantity(quantityStock(4))).toBe(4)
        expect(getCurrentQuantity(qualitativeStock('low'))).toBeNull()
        expect(getCurrentQualitativeLevel(qualitativeStock('low'))).toBe('low')
        expect(getCurrentQualitativeLevel(quantityStock(1))).toBe('unknown')
    })

    it('formats categories, units, levels, and plural labels', () => {
        expect(formatCategory('party-food')).toBe('Party Food')
        expect(formatUnit('kg')).toBe('kg')
        expect(formatUnit('box')).toBe('Box')
        expect(formatQuantityUnit(undefined, 1)).toBe('unit')
        expect(formatQuantityUnit('each', 2)).toBe('units')
        expect(formatQuantityUnit('kg', 2)).toBe('kg')
        expect(formatQuantityUnit('box', 2)).toBe('boxes')
        expect(formatQuantityUnit('tray', 2)).toBe('trays')
        expect(formatQuantityUnit('tray', 1)).toBe('tray')
        // units are typed by staff, so plurals are guessed from the text
        expect(formatQuantityUnit(' Cake ', 3)).toBe('cakes')
        expect(formatQuantityUnit('bags', 3)).toBe('bags')
        expect(formatQuantityUnit('punch', 2)).toBe('punches')
        expect(formatQualitativeLevel('out')).toBe('Out')
        expect(formatQualitativeLevel('medium')).toBe('Medium')
        expect(pluraliseItem(1)).toBe('item')
        expect(pluraliseItem(2)).toBe('items')
    })
})
