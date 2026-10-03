import { isOrderableInventoryItem } from '@fizz-kidz/core'
import type {
    InventoryActor,
    InventoryItem,
    InventoryLocation,
    InventoryQualitativeStockLevel,
    InventoryStockLevel,
    InventoryStockMovement,
} from '@fizz-kidz/core'

/** A single change to one item's stock at one studio. Each change writes one stock movement. */
export type InventoryStockChange =
    | { $type: 'received'; quantity: number }
    | { $type: 'counted'; quantity: number | null }
    | { $type: 'removed'; quantity: number }
    | { $type: 'level-updated'; level: InventoryQualitativeStockLevel }
    | { $type: 'reserved'; bookingId: string; quantity: number }
    | { $type: 'released'; bookingId: string; quantity: number }
    | { $type: 'used'; bookingId: string; quantity: number }

export class InventoryStockChangeError extends Error {}

/**
 * Applies a stock change to the current stock level, returning the next stock level and the movement that records it.
 * Pure, so it can run inside a Firestore transaction.
 */
export function applyInventoryStockChange(input: {
    item: InventoryItem
    location: InventoryLocation
    stockLevel: InventoryStockLevel | undefined
    stockLevelId: string
    change: InventoryStockChange
    reason?: string
    actor: InventoryActor
    movementId: string
    now: Date
}): { stockLevel: InventoryStockLevel; movement: InventoryStockMovement } {
    const { item, change } = input
    const base = {
        id: input.movementId,
        itemId: item.id,
        location: input.location,
        ...(input.reason ? { reason: input.reason } : {}),
        createdAt: input.now,
        createdBy: input.actor,
    }
    const nextStockLevel = (measurement: InventoryStockLevel['measurement'], reservedQuantity?: number) => {
        const stockLevel: InventoryStockLevel = {
            ...input.stockLevel,
            id: input.stockLevelId,
            itemId: item.id,
            location: input.location,
            stocked: input.stockLevel?.stocked ?? true,
            measurement,
            lastMovementAt: input.now,
            updatedAt: input.now,
        }
        if (reservedQuantity !== undefined) stockLevel.reservedQuantity = reservedQuantity
        return stockLevel
    }

    if (change.$type === 'level-updated') {
        if (item.$trackingMode !== 'qualitative') {
            throw new InventoryStockChangeError(`'${item.name}' is counted, so it can't be given a stock level`)
        }
        const levelBefore =
            input.stockLevel?.measurement.$type === 'qualitative' ? input.stockLevel.measurement.level : 'unknown'
        return {
            stockLevel: nextStockLevel({ $type: 'qualitative', level: change.level }),
            movement: { ...base, $type: 'level-updated', levelBefore, levelAfter: change.level },
        }
    }

    if (item.$trackingMode !== 'quantity') {
        throw new InventoryStockChangeError(`'${item.name}' uses stock levels, so it can't be counted`)
    }
    if (change.$type !== 'counted' && change.quantity <= 0) {
        throw new InventoryStockChangeError('Quantity must be more than zero')
    }

    const recordedQuantity =
        input.stockLevel?.measurement.$type === 'quantity' ? input.stockLevel.measurement.quantity : null
    // orderable stock is never unknown: an item linked to Square after it was created starts from zero
    const quantityBefore = recordedQuantity ?? (isOrderableInventoryItem(item) ? 0 : null)
    const reservedBefore = input.stockLevel?.reservedQuantity ?? 0

    if (change.$type === 'counted') {
        if (change.quantity === null && isOrderableInventoryItem(item)) {
            throw new InventoryStockChangeError(
                `'${item.name}' is orderable by customers, so its count can't be unknown`
            )
        }
        // stock customers order shouldn't change without anyone knowing why
        if (isOrderableInventoryItem(item) && change.quantity !== quantityBefore && !input.reason) {
            throw new InventoryStockChangeError(
                `The count for '${item.name}' doesn't match the ${quantityBefore ?? 'unknown count'} on record. Give a reason so the owners know why.`
            )
        }
        return {
            stockLevel: nextStockLevel({ $type: 'quantity', quantity: change.quantity }),
            movement: { ...base, $type: 'counted', quantityBefore, quantityAfter: change.quantity },
        }
    }

    if (quantityBefore === null) {
        throw new InventoryStockChangeError(`The count for '${item.name}' is unknown. Count it first.`)
    }

    switch (change.$type) {
        case 'received': {
            const quantityAfter = quantityBefore + change.quantity
            return {
                stockLevel: nextStockLevel({ $type: 'quantity', quantity: quantityAfter }),
                movement: { ...base, $type: 'received', quantity: change.quantity, quantityBefore, quantityAfter },
            }
        }
        case 'removed': {
            const quantityAfter = quantityBefore - change.quantity
            if (quantityAfter < 0) {
                throw new InventoryStockChangeError(`Only ${quantityBefore} of '${item.name}' on hand`)
            }
            return {
                stockLevel: nextStockLevel({ $type: 'quantity', quantity: quantityAfter }),
                movement: { ...base, $type: 'removed', quantity: change.quantity, quantityBefore, quantityAfter },
            }
        }
        case 'reserved': {
            if (!isOrderableInventoryItem(item)) {
                throw new InventoryStockChangeError(`'${item.name}' is not orderable by customers`)
            }
            // A paid order is always recorded, even if two parents just took the last one. Availability is checked
            // before payment, and going short alerts the owners.
            const reservedAfter = reservedBefore + change.quantity
            return {
                stockLevel: nextStockLevel({ $type: 'quantity', quantity: quantityBefore }, reservedAfter),
                movement: {
                    ...base,
                    $type: 'reserved',
                    bookingId: change.bookingId,
                    quantity: change.quantity,
                    reservedBefore,
                    reservedAfter,
                },
            }
        }
        case 'released': {
            // never below zero, so a stray release can't create stock out of nothing
            const reservedAfter = Math.max(reservedBefore - change.quantity, 0)
            return {
                stockLevel: nextStockLevel({ $type: 'quantity', quantity: quantityBefore }, reservedAfter),
                movement: {
                    ...base,
                    $type: 'released',
                    bookingId: change.bookingId,
                    quantity: change.quantity,
                    reservedBefore,
                    reservedAfter,
                },
            }
        }
        case 'used': {
            // stock may already be short (eg. a cake was thrown out), so clamp rather than fail the daily job
            const quantityAfter = Math.max(quantityBefore - change.quantity, 0)
            const reservedAfter = Math.max(reservedBefore - change.quantity, 0)
            return {
                stockLevel: nextStockLevel({ $type: 'quantity', quantity: quantityAfter }, reservedAfter),
                movement: {
                    ...base,
                    $type: 'used',
                    bookingId: change.bookingId,
                    quantity: change.quantity,
                    quantityBefore,
                    quantityAfter,
                    reservedBefore,
                    reservedAfter,
                },
            }
        }
    }
}
