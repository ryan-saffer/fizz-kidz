import { deepStrictEqual, strictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import {
    getCakeSupplyQuantity,
    getInventoryAvailableQuantity,
    getInventoryStockLevelId,
    getInventoryUsageRuleInventoryKey,
    getIsInventoryRunningLow,
    isLinkedInventoryCategory,
    isLinkedInventoryItem,
    isOrderableInventoryCategory,
    isOrderableInventoryItem,
    parseInventoryUsageRuleInventoryKey,
} from './inventory'

import type { InventoryStockLevel } from './inventory'

const quantity = (value: number | null, reservedQuantity?: number) =>
    ({ measurement: { $type: 'quantity', quantity: value }, reservedQuantity }) satisfies Pick<
        InventoryStockLevel,
        'measurement' | 'reservedQuantity'
    >
const level = (value: 'unknown' | 'out' | 'low' | 'medium' | 'high') =>
    ({ measurement: { $type: 'qualitative', level: value } }) satisfies Pick<InventoryStockLevel, 'measurement'>

const cake = {
    $trackingMode: 'quantity',
    category: 'cakes',
    squareCatalogObjectId: 'SQ',
    runningLowThreshold: 2,
} as const
const cups = { ...cake, category: 'cake-supplies' } as const
const food = { $trackingMode: 'quantity', category: 'party-food', runningLowThreshold: 5 } as const
const glitter = { $trackingMode: 'qualitative', category: 'party-food' } as const

describe('inventory', () => {
    it('builds stock level ids and cake supply quantities', () => {
        strictEqual(getInventoryStockLevelId('werribee', 'item-1'), 'werribee_item-1')
        strictEqual(getCakeSupplyQuantity('party', 12), 1)
        strictEqual(getCakeSupplyQuantity('child', 11), 17)
    })

    it('knows linked and orderable categories and items', () => {
        strictEqual(isLinkedInventoryCategory('cake-supplies'), true)
        strictEqual(isLinkedInventoryCategory('party-food'), false)
        strictEqual(isOrderableInventoryCategory('cakes'), true)
        strictEqual(isOrderableInventoryCategory('cake-supplies'), false)

        strictEqual(isLinkedInventoryItem(cups), true)
        strictEqual(isLinkedInventoryItem({ ...cake, squareCatalogObjectId: '' }), false)
        strictEqual(isLinkedInventoryItem(glitter), false)
        strictEqual(isOrderableInventoryItem(cake), true)
        strictEqual(isOrderableInventoryItem(cups), false)
    })

    it('works out available stock', () => {
        strictEqual(getInventoryAvailableQuantity(undefined), null)
        strictEqual(getInventoryAvailableQuantity(level('low')), null)
        strictEqual(getInventoryAvailableQuantity(quantity(null)), null)
        strictEqual(getInventoryAvailableQuantity(quantity(5)), 5)
        strictEqual(getInventoryAvailableQuantity(quantity(5, 2)), 3)
    })

    it('flags qualitative items that are low or out', () => {
        strictEqual(getIsInventoryRunningLow(glitter, level('low')), true)
        strictEqual(getIsInventoryRunningLow(glitter, level('out')), true)
        strictEqual(getIsInventoryRunningLow(glitter, level('medium')), false)
        strictEqual(getIsInventoryRunningLow(glitter, quantity(0)), false)
        strictEqual(getIsInventoryRunningLow(glitter, undefined), false)
    })

    it('compares available stock for orderable items and on-hand stock for the rest', () => {
        strictEqual(getIsInventoryRunningLow(cake, quantity(4, 2)), true)
        strictEqual(getIsInventoryRunningLow(cake, quantity(4)), false)
        strictEqual(getIsInventoryRunningLow(food, quantity(5)), true)
        strictEqual(getIsInventoryRunningLow(food, quantity(6)), false)
        strictEqual(getIsInventoryRunningLow(food, level('low')), false)
        strictEqual(getIsInventoryRunningLow(food, undefined), false)
        strictEqual(getIsInventoryRunningLow({ ...food, runningLowThreshold: null }, quantity(0)), false)
        strictEqual(getIsInventoryRunningLow({ $trackingMode: 'quantity', category: 'party-food' }, quantity(0)), false)
    })

    it('builds and parses usage rule inventory keys', () => {
        strictEqual(getInventoryUsageRuleInventoryKey('party-base', ' base '), 'party-base:base')
        deepStrictEqual(parseInventoryUsageRuleInventoryKey('party-addition:chickenNuggets'), {
            $type: 'party-addition',
            name: 'chickenNuggets',
        })
        deepStrictEqual(parseInventoryUsageRuleInventoryKey('party-base:a:b'), { $type: 'party-base', name: 'a:b' })
        strictEqual(parseInventoryUsageRuleInventoryKey(undefined), undefined)
        strictEqual(parseInventoryUsageRuleInventoryKey(''), undefined)
        strictEqual(parseInventoryUsageRuleInventoryKey('no-separator'), undefined)
        strictEqual(parseInventoryUsageRuleInventoryKey('unknown:name'), undefined)
        strictEqual(parseInventoryUsageRuleInventoryKey('party-base:'), undefined)
    })
})
