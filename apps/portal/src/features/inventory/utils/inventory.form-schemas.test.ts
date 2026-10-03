import { describe, expect, it } from 'vite-plus/test'

import {
    getReceiveDeliveryLines,
    getStockActionFormDefaultValues,
    getStockActionFormSchema,
    inventoryItemFormSchema,
    inventoryItemToFormValues,
    normalizeInventoryItemFormValues,
    normalizeStockActionFormValues,
    normalizeUsageRuleFormValues,
    receiveDeliveryFormSchema,
    usageRuleFormSchema,
    usageRuleToFormValues,
} from './inventory.form-schemas'

import type {
    ClientInventoryItem,
    ClientInventoryStockLevel,
    ClientInventoryUsageRule,
    StockAction,
} from './inventory.types'

const now = new Date('2026-05-01T00:00:00.000Z')

const quantityItem: ClientInventoryItem = {
    id: 'item-1',
    name: 'Party pies',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'quantity',
    baseUnit: 'each',
    runningLowThreshold: 10,
    notes: 'Notes',
    createdAt: now,
    updatedAt: now,
}

const qualitativeItem: ClientInventoryItem = {
    id: 'item-2',
    name: 'Glitter',
    category: 'party-food',
    status: 'archived',
    $trackingMode: 'qualitative',
    createdAt: now,
    updatedAt: now,
}

const quantityStock: ClientInventoryStockLevel = {
    id: 'stock-1',
    itemId: 'item-1',
    location: 'balwyn',
    stocked: true,
    measurement: { $type: 'quantity', quantity: 4 },
    updatedAt: now,
}

const qualitativeStock: ClientInventoryStockLevel = {
    id: 'stock-2',
    itemId: 'item-2',
    location: 'balwyn',
    stocked: true,
    measurement: { $type: 'qualitative', level: 'medium' },
    updatedAt: now,
}

describe('inventory form schemas', () => {
    it('maps inventory items to form values and normalizes quantity inputs', () => {
        expect(inventoryItemToFormValues(quantityItem)).toEqual({
            name: 'Party pies',
            category: 'party-food',
            $trackingMode: 'quantity',
            baseUnit: 'each',
            runningLowThreshold: '10',
            squareCatalogObjectId: '',
            status: 'active',
            notes: 'Notes',
        })

        expect(
            normalizeInventoryItemFormValues({
                $trackingMode: 'quantity',
                name: 'Party pies',
                category: 'party-food',
                baseUnit: 'each',
                runningLowThreshold: '',
                squareCatalogObjectId: '',
                status: 'active',
                notes: '',
            })
        ).toEqual({
            $trackingMode: 'quantity',
            name: 'Party pies',
            category: 'party-food',
            baseUnit: 'each',
            runningLowThreshold: null,
            squareCatalogObjectId: null,
            status: 'active',
            notes: '',
        })
    })

    it('maps qualitative items and clears empty inventory keys', () => {
        expect(inventoryItemToFormValues(qualitativeItem)).toMatchObject({
            baseUnit: '',
            runningLowThreshold: '',
            squareCatalogObjectId: '',
        })

        expect(
            normalizeInventoryItemFormValues({
                $trackingMode: 'qualitative',
                name: 'Glitter',
                category: 'party-food',
                baseUnit: 'tub',
                runningLowThreshold: '999',
                squareCatalogObjectId: 'square-cake',
                status: 'active',
                notes: '',
            })
        ).toMatchObject({
            $trackingMode: 'qualitative',
            runningLowThreshold: null,
            squareCatalogObjectId: null,
        })
    })

    it('maps and keeps the square catalog link on orderable quantity items', () => {
        expect(inventoryItemToFormValues({ ...quantityItem, squareCatalogObjectId: 'square-cake' })).toMatchObject({
            squareCatalogObjectId: 'square-cake',
        })
        expect(
            normalizeInventoryItemFormValues({
                ...inventoryItemToFormValues(quantityItem),
                $trackingMode: 'quantity',
                category: 'cakes',
                squareCatalogObjectId: 'square-cake',
            })
        ).toMatchObject({ $trackingMode: 'quantity', squareCatalogObjectId: 'square-cake' })
        // party food is never ordered by customers, so a leftover link is dropped
        expect(
            normalizeInventoryItemFormValues({
                ...inventoryItemToFormValues(quantityItem),
                $trackingMode: 'quantity',
                category: 'party-food',
                squareCatalogObjectId: 'square-cake',
            })
        ).toMatchObject({ squareCatalogObjectId: null })
    })

    it('requires cakes and take-home bags to be counted and linked to Square', () => {
        const values = { ...inventoryItemToFormValues(quantityItem), category: 'take-home-bags' as const }
        const result = inventoryItemFormSchema.safeParse({ ...values, squareCatalogObjectId: '' })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].path).toEqual(['squareCatalogObjectId'])
        expect(
            inventoryItemFormSchema.safeParse({ ...values, $trackingMode: 'qualitative' }).error?.issues[0].path
        ).toEqual(['$trackingMode'])
        expect(inventoryItemFormSchema.safeParse({ ...values, squareCatalogObjectId: 'square-bag' }).success).toBe(true)
    })

    it('adds custom inventory item quantity validation', () => {
        expect(
            inventoryItemFormSchema.safeParse({
                $trackingMode: 'quantity',
                name: 'Party pies',
                category: 'party-food',
                baseUnit: 'each',
                runningLowThreshold: '-1',
                squareCatalogObjectId: '',
                status: 'active',
                notes: '',
            }).success
        ).toBe(false)
        expect(
            inventoryItemFormSchema.safeParse({
                $trackingMode: 'quantity',
                name: 'Party pies',
                category: 'party-food',
                baseUnit: 'each',
                runningLowThreshold: '',
                squareCatalogObjectId: '',
                status: 'active',
                notes: '',
            }).success
        ).toBe(true)
    })

    it('maps and normalizes usage rule values for all operations', () => {
        const fixedRule: ClientInventoryUsageRule = {
            id: 'fixed',
            inventoryKey: 'party-base:partyPies',
            $type: 'party-base',
            label: 'Party pies',
            status: 'active',
            quantity: { $operation: 'fixed', quantity: 2 },
            createdAt: now,
            updatedAt: now,
        }
        const additionRule: ClientInventoryUsageRule = {
            id: 'addition',
            inventoryKey: 'party-addition:chickenNuggets',
            $type: 'party-addition',
            addition: 'chickenNuggets',
            status: 'active',
            quantity: { $operation: 'per-child', quantityPerChild: 1 },
            createdAt: now,
            updatedAt: now,
        }
        const perChildRule: ClientInventoryUsageRule = {
            id: 'per-child',
            inventoryKey: 'unparsed-key',
            $type: 'party-base',
            status: 'active',
            quantity: { $operation: 'per-child', quantityPerChild: 1 },
            createdAt: now,
            updatedAt: now,
        }
        const fixedPlusRule: ClientInventoryUsageRule = {
            id: 'fixed-plus',
            inventoryKey: 'party-food-package:fairyBread',
            $type: 'party-food-package',
            status: 'active',
            quantity: { $operation: 'fixed-plus-per-child', fixedQuantity: 1, quantityPerChild: 0.5 },
            createdAt: now,
            updatedAt: now,
        }

        expect(usageRuleToFormValues(fixedRule)).toMatchObject({
            $type: 'party-base',
            name: 'partyPies',
            quantity: { $operation: 'fixed', quantity: '2' },
        })
        expect(usageRuleToFormValues(additionRule)).toMatchObject({
            $type: 'party-addition',
            name: 'chickenNuggets',
            quantity: { $operation: 'per-child', quantityPerChild: '1' },
        })
        expect(usageRuleToFormValues(perChildRule)).toMatchObject({
            name: 'unparsed-key',
            quantity: { $operation: 'per-child', quantityPerChild: '1' },
        })
        expect(usageRuleToFormValues(fixedPlusRule)).toMatchObject({
            name: 'fairyBread',
            quantity: { $operation: 'fixed-plus-per-child', fixedQuantity: '1', quantityPerChild: '0.5' },
        })

        expect(
            normalizeUsageRuleFormValues({
                $type: 'party-base',
                name: ' partyPies ',
                label: 'Party pies',
                status: 'active',
                quantity: { $operation: 'fixed', quantity: '2' },
                notes: 'Order frozen',
            })
        ).toEqual({
            $type: 'party-base',
            name: 'partyPies',
            label: 'Party pies',
            status: 'active',
            quantity: { $operation: 'fixed', quantity: 2 },
            notes: 'Order frozen',
        })

        expect(
            normalizeUsageRuleFormValues({
                $type: 'party-addition',
                name: 'chickenNuggets',
                label: '',
                status: 'active',
                quantity: { $operation: 'per-child', quantityPerChild: '1' },
                notes: '',
            })
        ).toMatchObject({
            $type: 'party-addition',
            name: 'chickenNuggets',
            quantity: { $operation: 'per-child', quantityPerChild: 1 },
        })

        expect(
            normalizeUsageRuleFormValues({
                $type: 'party-food-package',
                name: ' fairyBread ',
                label: '',
                status: 'active',
                quantity: { $operation: 'fixed-plus-per-child', fixedQuantity: '1', quantityPerChild: '0.5' },
                notes: '',
            })
        ).toEqual({
            $type: 'party-food-package',
            name: 'fairyBread',
            label: undefined,
            status: 'active',
            quantity: { $operation: 'fixed-plus-per-child', fixedQuantity: 1, quantityPerChild: 0.5 },
            notes: undefined,
        })
    })

    it('adds custom usage rule numeric validation on top of zod shapes', () => {
        expect(
            usageRuleFormSchema.safeParse({
                $type: 'party-base',
                name: 'partyPies',
                label: '',
                status: 'active',
                quantity: { $operation: 'fixed', quantity: '0' },
                notes: '',
            }).success
        ).toBe(false)
        expect(
            usageRuleFormSchema.safeParse({
                $type: 'party-base',
                name: 'partyPies',
                label: '',
                status: 'active',
                quantity: { $operation: 'per-child', quantityPerChild: '0' },
                notes: '',
            }).success
        ).toBe(false)
        expect(
            usageRuleFormSchema.safeParse({
                $type: 'party-base',
                name: 'partyPies',
                label: '',
                status: 'active',
                quantity: { $operation: 'fixed-plus-per-child', fixedQuantity: '0', quantityPerChild: '1' },
                notes: '',
            }).success
        ).toBe(true)
    })

    it('validates stock action quantities and normalizes payloads', () => {
        const receive: StockAction = { $type: 'receive', item: quantityItem, stock: quantityStock }
        const count: StockAction = { $type: 'count', item: quantityItem, stock: quantityStock }
        const level: StockAction = { $type: 'level', item: qualitativeItem, stock: qualitativeStock }

        expect(
            getStockActionFormSchema(receive).safeParse({ quantity: '0', level: 'unknown', reason: '' }).success
        ).toBe(false)
        expect(
            getStockActionFormSchema(receive).safeParse({ quantity: 'abc', level: 'unknown', reason: '' }).success
        ).toBe(false)
        expect(
            getStockActionFormSchema(receive).safeParse({ quantity: '1.5', level: 'unknown', reason: '' }).success
        ).toBe(false)
        expect(
            getStockActionFormSchema(receive).safeParse({ quantity: '3', level: 'unknown', reason: '' }).success
        ).toBe(true)
        expect(getStockActionFormSchema(count).safeParse({ quantity: '', level: 'unknown', reason: '' }).success).toBe(
            false
        )
        expect(
            getStockActionFormSchema(count).safeParse({ quantity: '-1', level: 'unknown', reason: '' }).success
        ).toBe(false)
        // supplies can be recounted to any number (including zero) without a reason
        expect(getStockActionFormSchema(count).safeParse({ quantity: '0', level: 'unknown', reason: '' }).success).toBe(
            true
        )
        expect(getStockActionFormSchema(count).safeParse({ quantity: '9', level: 'unknown', reason: '' }).success).toBe(
            true
        )
        expect(getStockActionFormSchema(level).safeParse({ quantity: '', level: 'high', reason: '' }).success).toBe(
            true
        )
        // counts start empty so staff have to actually count
        expect(getStockActionFormDefaultValues(count)).toEqual({ quantity: '', level: 'unknown', reason: '' })
        expect(getStockActionFormDefaultValues(level)).toEqual({ quantity: '', level: 'medium', reason: '' })
        expect(normalizeStockActionFormValues({ quantity: '3', level: 'low', reason: ' counted ' })).toEqual({
            quantity: 3,
            level: 'low',
            reason: ' counted ',
        })
    })

    it('requires a reason when an orderable count does not match the record', () => {
        const orderableItem: ClientInventoryItem = { ...quantityItem, squareCatalogObjectId: 'square-cake' }
        const count: StockAction = { $type: 'count', item: orderableItem, stock: quantityStock }
        const schema = getStockActionFormSchema(count)

        expect(schema.safeParse({ quantity: '4', level: 'unknown', reason: '' }).success).toBe(true)

        const mismatch = schema.safeParse({ quantity: '3', level: 'unknown', reason: '' })
        expect(mismatch.success).toBe(false)
        expect(mismatch.error?.issues).toEqual([
            expect.objectContaining({ path: ['reason'], message: expect.stringContaining('4 on record') }),
        ])
        expect(schema.safeParse({ quantity: '3', level: 'unknown', reason: 'One was squashed' }).success).toBe(true)

        // an unknown count never matches, so a first count of an orderable item needs a reason too
        const unknownCount = getStockActionFormSchema({
            $type: 'count',
            item: orderableItem,
            stock: { ...quantityStock, measurement: { $type: 'quantity', quantity: null } },
        })
        expect(unknownCount.safeParse({ quantity: '2', level: 'unknown', reason: '' }).success).toBe(false)
    })

    it('requires a reason to remove stock and caps it at what is on hand', () => {
        const schema = getStockActionFormSchema({ $type: 'remove', item: quantityItem, stock: quantityStock })

        expect(schema.safeParse({ quantity: '0', level: 'unknown', reason: 'Damaged' }).success).toBe(false)

        const missingReason = schema.safeParse({ quantity: '2', level: 'unknown', reason: '' })
        expect(missingReason.error?.issues).toEqual([
            expect.objectContaining({ path: ['reason'], message: 'Say why it was removed.' }),
        ])

        const tooMany = schema.safeParse({ quantity: '5', level: 'unknown', reason: 'Damaged' })
        expect(tooMany.error?.issues).toEqual([
            expect.objectContaining({ path: ['quantity'], message: 'Only 4 on hand.' }),
        ])

        expect(schema.safeParse({ quantity: '4', level: 'unknown', reason: 'Damaged' }).success).toBe(true)
    })

    it('validates receive delivery quantities and builds receive lines', () => {
        const valid = {
            quantities: { cake: '3', bags: '', unicorn: '0' },
            note: 'Monthly drop',
            checked: true,
        }

        expect(receiveDeliveryFormSchema.safeParse(valid).success).toBe(true)
        expect(getReceiveDeliveryLines(valid)).toEqual([{ itemId: 'cake', quantity: 3 }])

        const unchecked = receiveDeliveryFormSchema.safeParse({ ...valid, checked: false })
        expect(unchecked.error?.issues).toEqual([expect.objectContaining({ path: ['checked'] })])

        const empty = receiveDeliveryFormSchema.safeParse({
            quantities: { cake: '', bags: '0' },
            note: '',
            checked: true,
        })
        expect(empty.error?.issues).toEqual([
            expect.objectContaining({ path: ['note'], message: 'Enter at least one quantity.' }),
        ])

        const fractional = receiveDeliveryFormSchema.safeParse({ ...valid, quantities: { cake: '1.5', bags: '2' } })
        expect(fractional.error?.issues).toEqual([
            expect.objectContaining({ path: ['quantities', 'cake'], message: 'Whole number' }),
        ])
    })
})
