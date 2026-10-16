import { getInventoryAvailableQuantity, isOrderableInventoryItem } from '@fizz-kidz/core'
import type { InventoryItem, InventoryStockMovement, Studio } from '@fizz-kidz/core'

import { writeInventoryStockChanges } from './inventory.stock.write'

import { DatabaseClient } from '@/integrations/firebase/database.client'

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

/**
 * Gives back everything still reserved for a booking at a studio, eg. when it's cancelled. Moving a party to another
 * studio passes its own `idempotencyKey`, so a later cancellation still releases what was reserved at the new studio.
 */
export async function releaseInventoryForBooking(input: {
    location: Studio
    bookingId: string
    idempotencyKey?: string
}) {
    await settleBookingReservations({
        location: input.location,
        bookingId: input.bookingId,
        idempotencyKey: input.idempotencyKey ?? `${input.bookingId}-released`,
        settle: () => 'released',
    })
}

/**
 * The party is over and paid on the studio terminal, so what was reserved for it has left the studio: it comes off
 * what's on hand as well as what's reserved. Staff confirm the cake was used; if it wasn't, it's still in the freezer,
 * so its reservation is given back instead.
 */
export async function useInventoryForBooking(input: { location: Studio; bookingId: string; cakeUsed: boolean }) {
    const items = await DatabaseClient.listInventoryItems({ includeArchived: true })
    const categories = new Map(items.map((item) => [item.id, item.category]))
    await settleBookingReservations({
        ...input,
        idempotencyKey: `${input.bookingId}-settled`,
        settle: (itemId) => (categories.get(itemId) === 'cakes' && !input.cakeUsed ? 'released' : 'used'),
    })
}

/** Releases or uses whatever is still reserved for a booking at the studio. Repeating it does nothing. */
async function settleBookingReservations(input: {
    location: Studio
    bookingId: string
    idempotencyKey: string
    settle: (itemId: string) => 'released' | 'used'
}) {
    const movements = await DatabaseClient.listInventoryStockMovementsForBooking(input.bookingId)
    // a party moved between stocked studios has reservations at both
    const atStudio = movements.filter((movement) => movement.location === input.location)
    const changes = [...getOutstandingReservations(atStudio)].map(([itemId, quantity]) => ({
        itemId,
        change: { $type: input.settle(itemId), bookingId: input.bookingId, quantity },
    }))
    if (changes.length === 0) return

    await writeInventoryStockChanges({
        location: input.location,
        changes,
        actor: { $type: 'system' },
        idempotencyKey: input.idempotencyKey,
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
