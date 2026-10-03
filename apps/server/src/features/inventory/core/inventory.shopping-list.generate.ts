import { ADDITIONS, STUDIOS } from '@fizz-kidz/core'
import type {
    Booking,
    InventoryItem,
    InventoryShoppingList,
    InventoryShoppingListLine,
    InventoryShoppingListSourceBreakdown,
    InventoryShoppingListStudioReport,
    InventoryShoppingListWarning,
    InventoryStockLevel,
    InventoryUsageRule,
    InventoryUsageRuleQuantity,
    Studio,
} from '@fizz-kidz/core'

import { inventoryShoppingListInputSchema } from './inventory.schemas'

import type { z } from 'zod'

import { DatabaseClient } from '@/integrations/firebase/database.client'

export const generateInventoryShoppingListInputSchema = inventoryShoppingListInputSchema

export type GenerateInventoryShoppingListInput = z.infer<typeof generateInventoryShoppingListInputSchema>

type BookingRecord = {
    id: string
    booking: Booking
}

type RequiredInventorySource = {
    rule: InventoryUsageRule
    label: string
    requiredQuantity: number
    bookingId: string
}

type RequiredInventoryAggregate = {
    inventoryKey: string
    requiredQuantity: number
    sourceBreakdown: InventoryShoppingListSourceBreakdown[]
}

export async function generateInventoryShoppingList(
    input: GenerateInventoryShoppingListInput
): Promise<InventoryShoppingList> {
    const locations = getShoppingListLocations(input.location)
    const [bookings, rules, items, stockLevels] = await Promise.all([
        DatabaseClient.listPartyBookingsForInventoryShoppingList({
            startDate: input.startDate,
            endDate: input.endDate,
            location: input.location === 'master' ? undefined : input.location,
        }),
        DatabaseClient.listInventoryUsageRules(),
        DatabaseClient.listInventoryItems({ includeArchived: true }),
        DatabaseClient.listInventoryStockLevels(),
    ])
    const activeRules = rules.filter((rule) => rule.status === 'active')
    const globalWarnings: InventoryShoppingListWarning[] = []

    if (activeRules.length === 0) {
        globalWarnings.push({
            $type: 'no-active-rules',
            message: 'No active inventory usage rules are configured.',
        })
    }

    const itemsByInventoryKey = getItemsByInventoryKey(items)
    const stockByLocationAndItemId = getStockByLocationAndItemId(stockLevels)
    const bookingsByLocation = groupBookingsByLocation(bookings)
    const studioReports = locations.map((location) =>
        generateStudioReport({
            location,
            bookings: bookingsByLocation.get(location) ?? [],
            rules: activeRules,
            itemsByInventoryKey,
            stockByLocationAndItemId,
        })
    )

    return {
        startDate: input.startDate,
        endDate: input.endDate,
        generatedAt: new Date(),
        bookingCount: studioReports.reduce((total, report) => total + report.bookingCount, 0),
        studioReports,
        warnings: [...globalWarnings, ...studioReports.flatMap((report) => report.warnings)],
    }
}

function getShoppingListLocations(location: GenerateInventoryShoppingListInput['location']) {
    if (location === 'master') {
        return [...STUDIOS]
    }

    return [location]
}

function generateStudioReport(input: {
    location: Studio
    bookings: BookingRecord[]
    rules: InventoryUsageRule[]
    itemsByInventoryKey: Map<string, InventoryItem[]>
    stockByLocationAndItemId: Map<string, InventoryStockLevel>
}): InventoryShoppingListStudioReport {
    const warnings: InventoryShoppingListWarning[] = []
    const requiredSources = input.bookings.flatMap((booking) =>
        getRequiredInventorySources(booking, input.rules, warnings)
    )
    const requiredByInventoryKey = aggregateRequiredSources(requiredSources)
    const lines: InventoryShoppingListLine[] = []

    for (const required of requiredByInventoryKey.values()) {
        const matchingItems = (input.itemsByInventoryKey.get(required.inventoryKey) ?? []).filter(
            (item) => item.status === 'active'
        )

        if (matchingItems.length === 0) {
            warnings.push({
                $type: 'missing-inventory-item',
                location: input.location,
                inventoryKey: required.inventoryKey,
                requiredQuantity: required.requiredQuantity,
            })
            continue
        }

        if (matchingItems.length > 1) {
            warnings.push({
                $type: 'duplicate-inventory-items',
                location: input.location,
                inventoryKey: required.inventoryKey,
                itemIds: matchingItems.map((item) => item.id),
                itemNames: matchingItems.map((item) => item.name),
            })
            continue
        }

        const item = matchingItems[0]
        const stockLevel = input.stockByLocationAndItemId.get(getStockMapKey(input.location, item.id))

        if (item.$trackingMode === 'qualitative') {
            warnings.push({
                $type: 'qualitative-item-required',
                location: input.location,
                inventoryKey: required.inventoryKey,
                itemId: item.id,
                itemName: item.name,
                requiredQuantity: required.requiredQuantity,
                level: stockLevel?.measurement.$type === 'qualitative' ? stockLevel.measurement.level : undefined,
            })
            continue
        }

        if (!stockLevel) {
            warnings.push({
                $type: 'missing-stock-level',
                location: input.location,
                inventoryKey: required.inventoryKey,
                itemId: item.id,
                itemName: item.name,
                requiredQuantity: required.requiredQuantity,
            })
            continue
        }

        if (!stockLevel.stocked) {
            warnings.push({
                $type: 'unused-at-location',
                location: input.location,
                inventoryKey: required.inventoryKey,
                itemId: item.id,
                itemName: item.name,
                requiredQuantity: required.requiredQuantity,
            })
        }

        if (stockLevel.measurement.$type !== 'quantity' || stockLevel.measurement.quantity === null) {
            warnings.push({
                $type: 'unknown-stock-quantity',
                location: input.location,
                inventoryKey: required.inventoryKey,
                itemId: item.id,
                itemName: item.name,
                requiredQuantity: required.requiredQuantity,
            })
        }

        const quantityOnHand =
            stockLevel.measurement.$type === 'quantity' && stockLevel.measurement.quantity !== null
                ? stockLevel.measurement.quantity
                : null

        const roundedRequiredQuantity = roundRequiredQuantity(required.requiredQuantity)

        lines.push({
            itemId: item.id,
            inventoryKey: required.inventoryKey,
            itemName: item.name,
            category: item.category,
            baseUnit: item.baseUnit,
            location: input.location,
            requiredQuantity: roundedRequiredQuantity,
            quantityOnHand,
            suggestedPurchaseQuantity:
                quantityOnHand === null ? null : Math.max(roundedRequiredQuantity - quantityOnHand, 0),
            stocked: stockLevel.stocked,
            sourceBreakdown: required.sourceBreakdown,
        })
    }

    return {
        location: input.location,
        bookingCount: input.bookings.length,
        lines: lines.sort((a, b) => a.itemName.localeCompare(b.itemName)),
        warnings,
    }
}

function getRequiredInventorySources(
    bookingRecord: BookingRecord,
    rules: InventoryUsageRule[],
    warnings: InventoryShoppingListWarning[]
) {
    const childCount = parseChildCount(bookingRecord.booking.numberOfChildren)
    if (childCount === null) {
        warnings.push({
            $type: 'invalid-child-count',
            bookingId: bookingRecord.id,
            location: bookingRecord.booking.location,
            bookingLabel: getBookingLabel(bookingRecord),
            value: bookingRecord.booking.numberOfChildren,
        })
    }

    return rules.flatMap((rule): RequiredInventorySource[] => {
        if (!doesRuleApplyToBooking(rule, bookingRecord.booking)) {
            return []
        }

        const requiredQuantity = calculateRequiredQuantity(rule.quantity, childCount)
        if (requiredQuantity <= 0) {
            return []
        }

        return [
            {
                rule,
                label: getRuleLabel(rule),
                requiredQuantity,
                bookingId: bookingRecord.id,
            },
        ]
    })
}

function doesRuleApplyToBooking(rule: InventoryUsageRule, booking: Booking) {
    switch (rule.$type) {
        case 'party-base':
            return true
        case 'party-food-package':
            return booking.includesFood
        case 'party-addition':
            return booking[rule.addition]
    }
}

function calculateRequiredQuantity(quantity: InventoryUsageRuleQuantity, childCount: number | null) {
    switch (quantity.$operation) {
        case 'fixed':
            return quantity.quantity
        case 'per-child':
            return childCount === null ? 0 : quantity.quantityPerChild * childCount
        case 'fixed-plus-per-child':
            return quantity.fixedQuantity + (childCount === null ? 0 : quantity.quantityPerChild * childCount)
    }
}

function aggregateRequiredSources(sources: RequiredInventorySource[]) {
    const requiredByInventoryKey = new Map<string, RequiredInventoryAggregate>()

    sources.forEach((source) => {
        const current = requiredByInventoryKey.get(source.rule.inventoryKey) ?? {
            inventoryKey: source.rule.inventoryKey,
            requiredQuantity: 0,
            sourceBreakdown: [],
        }
        current.requiredQuantity += source.requiredQuantity

        const sourceBreakdown = current.sourceBreakdown.find((breakdown) => breakdown.ruleId === source.rule.id)
        if (sourceBreakdown) {
            sourceBreakdown.requiredQuantity += source.requiredQuantity
            sourceBreakdown.bookingCount += 1
        } else {
            current.sourceBreakdown.push({
                ruleId: source.rule.id,
                label: source.label,
                requiredQuantity: source.requiredQuantity,
                bookingCount: 1,
            })
        }

        requiredByInventoryKey.set(source.rule.inventoryKey, current)
    })

    requiredByInventoryKey.forEach((required) => {
        required.requiredQuantity = roundRequiredQuantity(required.requiredQuantity)
        required.sourceBreakdown = required.sourceBreakdown.map((breakdown) => ({
            ...breakdown,
            requiredQuantity: roundRequiredQuantity(breakdown.requiredQuantity),
        }))
    })

    return requiredByInventoryKey
}

function parseChildCount(value: string | undefined) {
    if (!value) {
        return null
    }

    // parse ranges like '12 - 15' to just '15'
    const rangeMatch = value.trim().match(/^\d+\s*-\s*(\d+)$/)
    const childCount = Number(rangeMatch?.[1] ?? value)
    if (!Number.isInteger(childCount) || childCount < 0) {
        return null
    }

    return childCount
}

function getItemsByInventoryKey(items: InventoryItem[]) {
    const itemsByInventoryKey = new Map<string, InventoryItem[]>()

    items.forEach((item) => {
        if (!item.inventoryKey) return

        const itemsForKey = itemsByInventoryKey.get(item.inventoryKey) ?? []
        itemsForKey.push(item)
        itemsByInventoryKey.set(item.inventoryKey, itemsForKey)
    })

    return itemsByInventoryKey
}

function getStockByLocationAndItemId(stockLevels: InventoryStockLevel[]) {
    return new Map(
        stockLevels.map((stockLevel) => [getStockMapKey(stockLevel.location, stockLevel.itemId), stockLevel])
    )
}

function getStockMapKey(location: Studio, itemId: string) {
    return `${location}:${itemId}`
}

function groupBookingsByLocation(bookings: BookingRecord[]) {
    const bookingsByLocation = new Map<Studio, BookingRecord[]>()

    bookings.forEach((booking) => {
        const bookingsForLocation = bookingsByLocation.get(booking.booking.location) ?? []
        bookingsForLocation.push(booking)
        bookingsByLocation.set(booking.booking.location, bookingsForLocation)
    })

    return bookingsByLocation
}

function getRuleLabel(rule: InventoryUsageRule) {
    if (rule.label) return rule.label

    if (rule.$type === 'party-addition') {
        return ADDITIONS[rule.addition].displayValue
    }

    if (rule.$type === 'party-food-package') {
        return 'Party food package'
    }

    return 'Base party'
}

function getBookingLabel(bookingRecord: BookingRecord) {
    return bookingRecord.booking.childName || 'Party'
}

function roundRequiredQuantity(quantity: number) {
    return Math.round((quantity + Number.EPSILON) * 1000) / 1000
}
