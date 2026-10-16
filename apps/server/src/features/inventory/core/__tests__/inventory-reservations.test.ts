import { deepStrictEqual, strictEqual } from 'assert'

import { mockDatabaseClient, resetDatabaseClientMock } from '@test-support/database-client.mock'
import { afterEach, beforeEach, describe, it, vi } from 'vite-plus/test'

import { getInventoryStockLevelId } from '@fizz-kidz/core'
import type { InventoryItem, InventoryStockLevel, InventoryStockMovement } from '@fizz-kidz/core'

import {
    getOrderableInventory,
    getOutstandingReservations,
    releaseInventoryForBooking,
    reserveInventoryForBooking,
    useInventoryForBooking,
} from '../inventory.reservations'

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }))

vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))

const now = new Date('2026-10-02T00:00:00.000Z')

const cake = {
    id: 'unicorn',
    name: 'Unicorn cake',
    category: 'cakes',
    status: 'active',
    $trackingMode: 'quantity',
    baseUnit: 'each',
    runningLowThreshold: null,
    squareCatalogObjectId: 'SQUARE_UNICORN',
    createdAt: now,
    updatedAt: now,
} satisfies InventoryItem

function stock(itemId: string, quantity: number, reservedQuantity: number, stocked = true): InventoryStockLevel {
    return {
        id: getInventoryStockLevelId('werribee', itemId),
        itemId,
        location: 'werribee',
        stocked,
        measurement: { $type: 'quantity', quantity },
        reservedQuantity,
        updatedAt: now,
    }
}

function movement(
    $type: 'reserved' | 'released' | 'used',
    quantity: number,
    itemId = 'unicorn'
): InventoryStockMovement {
    return {
        id: `${$type}-${itemId}`,
        itemId,
        location: 'werribee',
        createdAt: now,
        createdBy: { $type: 'system' },
        $type,
        bookingId: 'booking-1',
        quantity,
        quantityBefore: 0,
        quantityAfter: 0,
        reservedBefore: 0,
        reservedAfter: 0,
    } as InventoryStockMovement
}

/** Captures the transaction input and runs it against the given stock. */
function mockTransaction(stockLevels: InventoryStockLevel[]) {
    const calls: { idempotencyKey?: string; movements: InventoryStockMovement[] }[] = []
    mockDatabaseClient.runInventoryStockTransaction = async (input) => {
        const writes = input.buildWrites({
            items: new Map([[cake.id, cake]]),
            stockLevels: new Map(stockLevels.map((stockLevel) => [stockLevel.itemId, stockLevel])),
            createMovementId: (itemId) => `${input.idempotencyKey}_${itemId}`,
            now,
        })
        calls.push({ idempotencyKey: input.idempotencyKey, movements: writes.map((write) => write.movement) })
        return writes
    }
    return calls
}

describe('inventory reservations', () => {
    beforeEach(() => {
        mocks.sendEmail.mockReset()
    })

    afterEach(() => {
        resetDatabaseClientMock()
    })

    it('lists what customers can order by Square id, ignoring unlinked, unused and archived items', async () => {
        mockDatabaseClient.listInventoryItems = async () => [
            cake,
            { ...cake, id: 'dino', squareCatalogObjectId: 'SQUARE_DINO' },
            { ...cake, id: 'nuggets', squareCatalogObjectId: undefined },
        ]
        mockDatabaseClient.listInventoryStockLevels = async () => [
            stock('unicorn', 3, 1),
            stock('dino', 5, 0, false),
            stock('nuggets', 40, 0),
        ]

        const orderable = await getOrderableInventory('werribee')

        deepStrictEqual([...orderable.keys()], ['SQUARE_UNICORN'])
        strictEqual(orderable.get('SQUARE_UNICORN')?.available, 2)
    })

    it('reserves for a booking, keyed so a replayed submission does nothing', async () => {
        const calls = mockTransaction([stock('unicorn', 3, 0)])

        await reserveInventoryForBooking({
            location: 'werribee',
            bookingId: 'booking-1',
            reservationId: 'square-order',
            lines: [{ itemId: 'unicorn', quantity: 1 }],
        })

        strictEqual(calls[0].idempotencyKey, 'square-order-reserved')
        deepStrictEqual(
            calls[0].movements.map((m) => [m.$type, m.$type === 'reserved' && m.bookingId]),
            [['reserved', 'booking-1']]
        )
    })

    it('works out what is still reserved from a booking’s movements', () => {
        const outstanding = getOutstandingReservations([
            movement('reserved', 1),
            movement('reserved', 12, 'lolly'),
            movement('released', 12, 'lolly'),
            movement('reserved', 2, 'dino'),
            movement('used', 1, 'dino'),
        ])

        deepStrictEqual(
            [...outstanding],
            [
                ['unicorn', 1],
                ['dino', 1],
            ]
        )
    })

    it('releases what is still reserved when a booking is cancelled', async () => {
        mockDatabaseClient.listInventoryStockMovementsForBooking = async () => [movement('reserved', 1)]
        const calls = mockTransaction([stock('unicorn', 3, 1)])

        await releaseInventoryForBooking({ location: 'werribee', bookingId: 'booking-1' })

        strictEqual(calls[0].idempotencyKey, 'booking-1-released')
        deepStrictEqual(
            calls[0].movements.map((m) => m.$type),
            ['released']
        )
    })

    it('only releases what is reserved at the studio, with the key a studio move gives it', async () => {
        const atGeelong = { ...movement('reserved', 1), id: 'geelong-reserved', location: 'geelong' as const }
        const releasedAtGeelong = { ...movement('released', 1), id: 'geelong-released', location: 'geelong' as const }
        mockDatabaseClient.listInventoryStockMovementsForBooking = async () =>
            [atGeelong, releasedAtGeelong, movement('reserved', 2)] as InventoryStockMovement[]
        const calls = mockTransaction([stock('unicorn', 3, 2)])

        await releaseInventoryForBooking({ location: 'werribee', bookingId: 'booking-1', idempotencyKey: 'move-1' })

        strictEqual(calls[0].idempotencyKey, 'move-1')
        deepStrictEqual(
            calls[0].movements.map((m) => m.$type === 'released' && m.quantity),
            [2]
        )
    })

    it('does nothing for a booking with nothing reserved', async () => {
        mockDatabaseClient.listInventoryStockMovementsForBooking = async () => []
        const calls = mockTransaction([])

        await releaseInventoryForBooking({ location: 'werribee', bookingId: 'booking-1' })

        strictEqual(calls.length, 0)
    })

    it('uses what is still reserved for a booking once its party is paid', async () => {
        mockDatabaseClient.listInventoryStockMovementsForBooking = async () => [movement('reserved', 1)]
        mockDatabaseClient.listInventoryItems = async () => [cake]
        const calls = mockTransaction([stock('unicorn', 3, 1)])

        await useInventoryForBooking({ location: 'werribee', bookingId: 'booking-1', cakeUsed: true })

        strictEqual(calls[0].idempotencyKey, 'booking-1-settled')
        deepStrictEqual(
            calls[0].movements.map((m) => m.$type === 'used' && [m.quantityAfter, m.reservedAfter]),
            [[2, 0]]
        )
    })

    it('gives a cake the party didn’t use back to stock', async () => {
        mockDatabaseClient.listInventoryStockMovementsForBooking = async () => [movement('reserved', 1)]
        mockDatabaseClient.listInventoryItems = async () => [cake]
        const calls = mockTransaction([stock('unicorn', 3, 1)])

        await useInventoryForBooking({ location: 'werribee', bookingId: 'booking-1', cakeUsed: false })

        deepStrictEqual(
            calls[0].movements.map((m) => m.$type === 'released' && [m.reservedAfter]),
            [[0]]
        )
    })
})
