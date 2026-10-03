import { DateTime } from 'luxon'

import { getInventoryAvailableQuantity, isOrderableInventoryItem, STOCKED_PARTY_ORDER_STUDIOS } from '@fizz-kidz/core'
import type { InventoryItem, InventoryStockMovement, Studio } from '@fizz-kidz/core'

import { writeInventoryStockChanges } from './inventory.stock.write'

import { DatabaseClient } from '@/integrations/firebase/database.client'
import { logError } from '@/integrations/observability/log-error'

/**
 * What customers can order from a studio's stock right now, keyed by Square catalog object id. Items that aren't linked
 * to Square, aren't tracked at the studio or are archived are left out.
 */
export async function getOrderableInventory(location: Studio) {
    const [items, stockLevels] = await Promise.all([
        DatabaseClient.listInventoryItems(),
        DatabaseClient.listInventoryStockLevels({ location }),
    ])
    const stockByItemId = new Map(stockLevels.map((stockLevel) => [stockLevel.itemId, stockLevel]))

    return new Map(
        items.flatMap((item) => {
            const stockLevel = stockByItemId.get(item.id)
            if (!isOrderableInventoryItem(item) || !stockLevel?.stocked) return []
            const available = Math.max(getInventoryAvailableQuantity(stockLevel) ?? 0, 0)
            return [[item.squareCatalogObjectId, { item, available }] as const]
        })
    )
}

/**
 * Reserves what a booking paid for. Safe to repeat with the same `reservationId` (eg. a replayed submission).
 * Availability is checked before payment, so this always records the order, even if it leaves the studio short.
 */
export async function reserveInventoryForBooking(input: {
    location: Studio
    bookingId: string
    reservationId: string
    lines: { itemId: string; quantity: number }[]
}) {
    await writeInventoryStockChanges({
        location: input.location,
        changes: input.lines.map((line) => ({
            itemId: line.itemId,
            change: { $type: 'reserved', bookingId: input.bookingId, quantity: line.quantity },
        })),
        actor: { $type: 'system' },
        idempotencyKey: `${input.reservationId}-reserved`,
    })
}

/** Gives back everything still reserved for a booking, eg. when it's cancelled. */
export async function releaseInventoryForBooking(input: { location: Studio; bookingId: string }) {
    await settleBookingReservations({ ...input, $type: 'released' })
}

/**
 * Run daily: reserved stock for parties that happened yesterday has left the studio, so it comes off what's on hand.
 * Each booking is settled on its own, so one failure doesn't stop the rest.
 */
export async function useInventoryForPastParties() {
    const today = DateTime.now().setZone('Australia/Melbourne').startOf('day')
    const results = await Promise.allSettled(
        STOCKED_PARTY_ORDER_STUDIOS.map(async (location) => {
            const bookings = await DatabaseClient.listPartyBookingsForInventoryShoppingList({
                startDate: today.minus({ days: 1 }).toJSDate(),
                endDate: today.toJSDate(),
                location,
            })
            const settled = await Promise.allSettled(
                bookings.map(({ id }) => settleBookingReservations({ location, bookingId: id, $type: 'used' }))
            )
            settled.forEach((result, idx) => {
                if (result.status === 'rejected')
                    logError('Unable to use inventory reserved for a party', result.reason, {
                        bookingId: bookings[idx].id,
                    })
            })
        })
    )
    results.forEach((result, idx) => {
        if (result.status === 'rejected')
            logError('Unable to use inventory for past parties', result.reason, {
                location: STOCKED_PARTY_ORDER_STUDIOS[idx],
            })
    })
}

/** Releases or uses whatever is still reserved for a booking. Repeating it does nothing. */
async function settleBookingReservations(input: { location: Studio; bookingId: string; $type: 'released' | 'used' }) {
    const movements = await DatabaseClient.listInventoryStockMovementsForBooking(input.bookingId)
    const changes = [...getOutstandingReservations(movements)].map(([itemId, quantity]) => ({
        itemId,
        change: { $type: input.$type, bookingId: input.bookingId, quantity },
    }))
    if (changes.length === 0) return

    await writeInventoryStockChanges({
        location: input.location,
        changes,
        actor: { $type: 'system' },
        idempotencyKey: `${input.bookingId}-${input.$type}`,
    })
}

/** How much of each item is still reserved for a booking, from its stock movements. */
export function getOutstandingReservations(movements: InventoryStockMovement[]) {
    const outstanding = new Map<InventoryItem['id'], number>()
    movements.forEach((movement) => {
        if (movement.$type !== 'reserved' && movement.$type !== 'released' && movement.$type !== 'used') return
        const sign = movement.$type === 'reserved' ? 1 : -1
        outstanding.set(movement.itemId, (outstanding.get(movement.itemId) ?? 0) + sign * movement.quantity)
    })
    return new Map([...outstanding].filter(([, quantity]) => quantity > 0))
}
