import { deepStrictEqual, strictEqual, throws } from 'assert'

import { mockDatabaseClient, resetDatabaseClientMock } from '@test-support/database-client.mock'
import { afterEach, beforeEach, describe, it, vi } from 'vite-plus/test'

import { getInventoryStockLevelId } from '@fizz-kidz/core'
import type { InventoryItem, InventoryStockLevel } from '@fizz-kidz/core'

import { getInventoryAlerts } from '../inventory.alerts'
import { applyInventoryStockChange } from '../inventory.stock.changes'
import { countInventoryStock } from '../inventory.stock.count'
import { receiveInventoryStock } from '../inventory.stock.receive'

import type { InventoryStockChange } from '../inventory.stock.changes'

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }))

vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))

const actor = { $type: 'staff', uid: 'uid-1', email: 'staff@example.com' } as const
const now = new Date('2026-10-02T00:00:00.000Z')

const nuggets = {
    id: 'nuggets',
    name: 'Chicken nuggets',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'quantity',
    baseUnit: 'each',
    runningLowThreshold: 20,
    createdAt: now,
    updatedAt: now,
} satisfies InventoryItem

const unicornCake = {
    ...nuggets,
    id: 'unicorn',
    name: 'Unicorn cake',
    category: 'cakes',
    runningLowThreshold: 1,
    squareCatalogObjectId: 'SQUARE_UNICORN',
} satisfies InventoryItem

const glitter = {
    id: 'glitter',
    name: 'Glitter',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'qualitative',
    createdAt: now,
    updatedAt: now,
} satisfies InventoryItem

function stock(itemId: string, quantity: number | null, reservedQuantity?: number): InventoryStockLevel {
    return {
        id: getInventoryStockLevelId('werribee', itemId),
        itemId,
        location: 'werribee',
        stocked: true,
        measurement: { $type: 'quantity', quantity },
        ...(reservedQuantity !== undefined && { reservedQuantity }),
        updatedAt: now,
    }
}

function apply(item: InventoryItem, stockLevel: InventoryStockLevel | undefined, change: InventoryStockChange) {
    return applyInventoryStockChange({
        item,
        location: 'werribee',
        stockLevel,
        stockLevelId: getInventoryStockLevelId('werribee', item.id),
        change,
        actor,
        movementId: 'movement-1',
        now,
    })
}

/** Runs the transaction against an in-memory copy of the given items and stock levels. */
function mockTransaction(items: InventoryItem[], stockLevels: InventoryStockLevel[]) {
    const written: ReturnType<typeof apply>[] = []
    let movementCount = 0
    mockDatabaseClient.runInventoryStockTransaction = async (input) => {
        const writes = input.buildWrites({
            items: new Map(items.map((item) => [item.id, item])),
            stockLevels: new Map(stockLevels.map((stockLevel) => [stockLevel.itemId, stockLevel])),
            createMovementId: () => `movement-${++movementCount}`,
            now,
        })
        written.push(...writes)
        return writes
    }
    return written
}

describe('inventory stock', () => {
    beforeEach(() => {
        mocks.sendEmail.mockReset()
    })

    afterEach(() => {
        resetDatabaseClientMock()
    })

    describe('applyInventoryStockChange', () => {
        it('receives stock onto the count', () => {
            const { stockLevel, movement } = apply(nuggets, stock('nuggets', 10), { $type: 'received', quantity: 5 })

            deepStrictEqual(stockLevel.measurement, { $type: 'quantity', quantity: 15 })
            deepStrictEqual(movement, {
                id: 'movement-1',
                itemId: 'nuggets',
                location: 'werribee',
                createdAt: now,
                createdBy: actor,
                $type: 'received',
                quantity: 5,
                quantityBefore: 10,
                quantityAfter: 15,
            })
        })

        it('needs a known count before receiving or removing', () => {
            throws(() => apply(nuggets, stock('nuggets', null), { $type: 'received', quantity: 5 }), /Count it first/)
            throws(() => apply(nuggets, undefined, { $type: 'removed', quantity: 1 }), /Count it first/)
        })

        it('starts an orderable item with an unknown count from zero, eg. one linked to Square after it was created', () => {
            const { stockLevel } = apply(unicornCake, stock('unicorn', null), { $type: 'received', quantity: 4 })
            deepStrictEqual(stockLevel.measurement, { $type: 'quantity', quantity: 4 })
        })

        it('counts, including marking a consumable unknown', () => {
            const { stockLevel, movement } = apply(nuggets, stock('nuggets', 10), { $type: 'counted', quantity: null })

            deepStrictEqual(stockLevel.measurement, { $type: 'quantity', quantity: null })
            strictEqual(movement.$type, 'counted')
        })

        it('never lets an orderable item become unknown', () => {
            throws(() => apply(unicornCake, stock('unicorn', 3, 0), { $type: 'counted', quantity: null }), /unknown/)
        })

        it('removes stock but not below zero', () => {
            const { stockLevel } = apply(nuggets, stock('nuggets', 10), { $type: 'removed', quantity: 4 })
            deepStrictEqual(stockLevel.measurement, { $type: 'quantity', quantity: 6 })

            throws(() => apply(nuggets, stock('nuggets', 2), { $type: 'removed', quantity: 3 }), /Only 2/)
        })

        it('reserves orderable stock without changing what is on hand', () => {
            const { stockLevel, movement } = apply(unicornCake, stock('unicorn', 3, 1), {
                $type: 'reserved',
                bookingId: 'booking-1',
                quantity: 2,
            })

            deepStrictEqual(stockLevel.measurement, { $type: 'quantity', quantity: 3 })
            strictEqual(stockLevel.reservedQuantity, 3)
            deepStrictEqual(
                { bookingId: movement.$type === 'reserved' && movement.bookingId, reservedAfter: 3 },
                { bookingId: 'booking-1', reservedAfter: 3 }
            )
        })

        it('records a paid reservation even if it leaves the studio short, but only for orderable items', () => {
            const { stockLevel } = apply(unicornCake, stock('unicorn', 3, 3), {
                $type: 'reserved',
                bookingId: 'b',
                quantity: 1,
            })
            strictEqual(stockLevel.reservedQuantity, 4)

            throws(
                () => apply(nuggets, stock('nuggets', 30), { $type: 'reserved', bookingId: 'b', quantity: 1 }),
                /not orderable/
            )
        })

        it('releases reservations and uses them when the party happens', () => {
            const released = apply(unicornCake, stock('unicorn', 3, 2), {
                $type: 'released',
                bookingId: 'b',
                quantity: 1,
            })
            deepStrictEqual(released.stockLevel.measurement, { $type: 'quantity', quantity: 3 })
            strictEqual(released.stockLevel.reservedQuantity, 1)

            const used = apply(unicornCake, stock('unicorn', 3, 2), { $type: 'used', bookingId: 'b', quantity: 1 })
            deepStrictEqual(used.stockLevel.measurement, { $type: 'quantity', quantity: 2 })
            strictEqual(used.stockLevel.reservedQuantity, 1)
        })

        it('updates qualitative levels only for qualitative items', () => {
            const { stockLevel, movement } = apply(glitter, undefined, { $type: 'level-updated', level: 'low' })
            deepStrictEqual(stockLevel.measurement, { $type: 'qualitative', level: 'low' })
            deepStrictEqual(movement.$type === 'level-updated' && [movement.levelBefore, movement.levelAfter], [
                'unknown',
                'low',
            ])

            throws(() => apply(nuggets, stock('nuggets', 1), { $type: 'level-updated', level: 'low' }))
            throws(() => apply(glitter, undefined, { $type: 'received', quantity: 1 }))
        })
    })

    describe('alerts', () => {
        it('alerts once when an item crosses its running-low threshold', () => {
            const crossing = apply(nuggets, stock('nuggets', 25), { $type: 'counted', quantity: 18 })
            const alreadyLow = apply(nuggets, stock('nuggets', 18), { $type: 'counted', quantity: 15 })

            deepStrictEqual(
                getInventoryAlerts([{ item: nuggets, before: stock('nuggets', 25), ...crossing }]).map((a) => a.title),
                ['Chicken nuggets: running low']
            )
            deepStrictEqual(getInventoryAlerts([{ item: nuggets, before: stock('nuggets', 18), ...alreadyLow }]), [])
        })

        it('compares available stock for orderable items, so a reservation can trigger running low', () => {
            const before = stock('unicorn', 3, 1)
            const write = apply(unicornCake, before, { $type: 'reserved', bookingId: 'b', quantity: 1 })

            deepStrictEqual(
                getInventoryAlerts([{ item: unicornCake, before, ...write }]).map((a) => a.title),
                ['Unicorn cake: running low']
            )
        })

        it('flags orderable count mismatches and stock that will leave a party short', () => {
            const before = stock('unicorn', 3, 3)
            const write = applyInventoryStockChange({
                item: unicornCake,
                location: 'werribee',
                stockLevel: before,
                stockLevelId: before.id,
                change: { $type: 'counted', quantity: 2 },
                reason: 'Found one melted',
                actor,
                movementId: 'm',
                now,
            })

            const alerts = getInventoryAlerts([{ item: unicornCake, before, ...write }])
            deepStrictEqual(
                alerts.map((alert) => alert.title),
                ["Unicorn cake: count didn't match", 'Unicorn cake: not enough for upcoming parties']
            )
            strictEqual(alerts[0].detail.includes('Found one melted'), true)
        })
    })

    describe('countInventoryStock', () => {
        it('requires a reason when an orderable count does not match', async () => {
            mockTransaction([unicornCake], [stock('unicorn', 3, 1)])

            await countInventoryStock(
                { location: 'werribee', lines: [{ itemId: 'unicorn', quantity: 2 }] },
                actor
            ).then(
                () => {
                    throw new Error('expected count to be rejected')
                },
                (err: Error) => strictEqual(err.message.includes('Give a reason'), true)
            )
        })

        it('saves a matching orderable count without a reason or alert', async () => {
            const written = mockTransaction([unicornCake], [stock('unicorn', 3, 1)])

            await countInventoryStock({ location: 'werribee', lines: [{ itemId: 'unicorn', quantity: 3 }] }, actor)

            strictEqual(written.length, 1)
            strictEqual(mocks.sendEmail.mock.calls.length, 0)
        })

        it('counts every cake at once, with one reason and one email for the mismatches', async () => {
            const dino = { ...unicornCake, id: 'dino', name: 'Dinosaur cake' }
            const written = mockTransaction([unicornCake, dino], [stock('unicorn', 3, 1), stock('dino', 2, 0)])

            const result = await countInventoryStock(
                {
                    location: 'werribee',
                    lines: [
                        { itemId: 'unicorn', quantity: 2 },
                        { itemId: 'dino', quantity: 2 },
                    ],
                    reason: 'Dropped one',
                },
                actor
            )

            deepStrictEqual(
                result.map((stockLevel) => stockLevel.measurement),
                [
                    { $type: 'quantity', quantity: 2 },
                    { $type: 'quantity', quantity: 2 },
                ]
            )
            strictEqual(written.length, 2)
            strictEqual(mocks.sendEmail.mock.calls.length, 1)
            const [template, to, values] = mocks.sendEmail.mock.calls[0]
            strictEqual(template, 'inventoryAlert')
            strictEqual(to, 'werribee@fizzkidz.com.au')
            deepStrictEqual(
                values.alerts.map((alert: { title: string }) => alert.title),
                // the matching dinosaur count raises nothing
                ["Unicorn cake: count didn't match", 'Unicorn cake: running low']
            )
        })
    })

    describe('receiveInventoryStock', () => {
        it('receives every line of a delivery in one transaction', async () => {
            const written = mockTransaction(
                [unicornCake, { ...unicornCake, id: 'dino', name: 'Dinosaur cake' }],
                [stock('unicorn', 0, 0), stock('dino', 1, 1)]
            )

            const result = await receiveInventoryStock(
                {
                    location: 'werribee',
                    lines: [
                        { itemId: 'unicorn', quantity: 4 },
                        { itemId: 'dino', quantity: 2 },
                    ],
                    note: 'October delivery',
                },
                actor
            )

            deepStrictEqual(
                result.map((stockLevel) => stockLevel.measurement),
                [
                    { $type: 'quantity', quantity: 4 },
                    { $type: 'quantity', quantity: 3 },
                ]
            )
            deepStrictEqual(
                written.map(({ movement }) => [movement.$type, movement.reason]),
                [
                    ['received', 'October delivery'],
                    ['received', 'October delivery'],
                ]
            )
        })
    })
})
