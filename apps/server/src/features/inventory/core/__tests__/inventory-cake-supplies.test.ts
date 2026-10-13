import { deepStrictEqual, strictEqual } from 'assert'

import { mockDatabaseClient, resetDatabaseClientMock } from '@test-support/database-client.mock'
import { afterEach, describe, it, vi } from 'vite-plus/test'

import { getInventoryStockLevelId } from '@fizz-kidz/core'
import type { InventoryItem, InventoryStockLevel } from '@fizz-kidz/core'

import { getCakeSuppliesByOption, useCakeSuppliesForBooking } from '../inventory.cake-supplies'

vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: vi.fn() }) },
}))

const now = new Date('2026-10-12T00:00:00.000Z')

function supply(id: string, squareCatalogObjectId: string, usedPer: 'party' | 'child'): InventoryItem {
    return {
        id,
        name: id,
        category: 'cake-supplies',
        status: 'active',
        $trackingMode: 'quantity',
        baseUnit: 'each',
        runningLowThreshold: null,
        squareCatalogObjectId,
        usedPer,
        createdAt: now,
        updatedAt: now,
    }
}

const cups = supply('cups', 'SQUARE_CUP', 'child')
const spoons = supply('spoons', 'SQUARE_CUP', 'child')
const candles = supply('candles', 'SQUARE_CANDLES', 'party')

function stock(itemId: string, quantity: number, stocked = true): InventoryStockLevel {
    return {
        id: getInventoryStockLevelId('werribee', itemId),
        itemId,
        location: 'werribee',
        stocked,
        measurement: { $type: 'quantity', quantity },
        updatedAt: now,
    }
}

describe('cake supplies', () => {
    afterEach(() => {
        resetDatabaseClientMock()
    })

    it('groups the supplies a studio stocks by the Square option that uses them', async () => {
        mockDatabaseClient.listInventoryItems = async () => [cups, spoons, candles]
        mockDatabaseClient.listInventoryStockLevels = async () => [
            stock('cups', 100),
            stock('spoons', 100),
            stock('candles', 10, false),
        ]

        const supplies = await getCakeSuppliesByOption('werribee')

        deepStrictEqual(
            [...supplies].map(([option, items]) => [option, items.map((item) => item.id)]),
            [['SQUARE_CUP', ['cups', 'spoons']]]
        )
    })

    it('uses 1.5 per child, rounded up, of cups and spoons, and one pack of candles, once', async () => {
        mockDatabaseClient.listInventoryItems = async () => [cups, spoons, candles]
        mockDatabaseClient.listInventoryStockLevels = async () => [
            stock('cups', 100),
            stock('spoons', 100),
            stock('candles', 10),
        ]
        const stockLevels = new Map([
            ['cups', stock('cups', 100)],
            ['spoons', stock('spoons', 100)],
            ['candles', stock('candles', 10)],
        ])
        let idempotencyKey: string | undefined
        let used: [string, number][] = []
        mockDatabaseClient.runInventoryStockTransaction = async (input) => {
            idempotencyKey = input.idempotencyKey
            const writes = input.buildWrites({
                items: new Map([cups, spoons, candles].map((item) => [item.id, item])),
                stockLevels,
                createMovementId: (itemId) => `${input.idempotencyKey}_${itemId}`,
                now,
            })
            used = writes.map(({ movement }) => [
                movement.itemId,
                movement.$type === 'used' ? movement.quantityAfter : -1,
            ])
            return writes
        }

        await useCakeSuppliesForBooking({
            location: 'werribee',
            bookingId: 'booking-1',
            optionIds: ['SQUARE_CUP', 'SQUARE_CANDLES', 'SQUARE_UNKNOWN'],
            children: 15,
        })

        strictEqual(idempotencyKey, 'booking-1-supplies-used')
        // 15 children use 23 cups and 23 spoons
        deepStrictEqual(used, [
            ['cups', 77],
            ['spoons', 77],
            ['candles', 9],
        ])
    })

    it('does nothing when the cake used no tracked supplies, eg. bring your own bowls', async () => {
        mockDatabaseClient.listInventoryItems = async () => [cups]
        mockDatabaseClient.listInventoryStockLevels = async () => [stock('cups', 100)]
        let transactions = 0
        mockDatabaseClient.runInventoryStockTransaction = async () => {
            transactions++
            return []
        }

        await useCakeSuppliesForBooking({
            location: 'werribee',
            bookingId: 'booking-1',
            optionIds: ['SQUARE_OWN_BOWLS'],
            children: 15,
        })

        strictEqual(transactions, 0)
    })
})
