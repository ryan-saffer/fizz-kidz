import { deepStrictEqual, ok, rejects, strictEqual } from 'assert'

import { mockDatabaseClient, resetDatabaseClientMock } from '@test-support/database-client.mock'
import { FieldValue } from 'firebase-admin/firestore'
import { afterEach, describe, it } from 'vite-plus/test'

import { getInventoryStockLevelId, STUDIOS } from '@fizz-kidz/core'
import type {
    Addition,
    Booking,
    InventoryItem,
    InventoryShoppingListWarning,
    InventoryStockLevel,
    InventoryStockMovement,
    InventoryUsageRule,
} from '@fizz-kidz/core'

import { createInventoryItem } from '../inventory.items.create'
import { deleteInventoryItem } from '../inventory.items.delete'
import { listInventoryItems } from '../inventory.items.list'
import { updateInventoryItem } from '../inventory.items.update'
import { additionSchema, inventoryShoppingListInputSchema, studioSchema } from '../inventory.schemas'
import { generateInventoryShoppingList } from '../inventory.shopping-list.generate'
import { listInventoryStockMovements } from '../inventory.stock-movements.list'
import { listInventoryStock } from '../inventory.stock.list'
import { setInventoryStocked } from '../inventory.stock.set-stocked'
import { createInventoryUsageRule } from '../inventory.usage-rules.create'
import { deleteInventoryUsageRule } from '../inventory.usage-rules.delete'
import { listInventoryUsageRules } from '../inventory.usage-rules.list'
import { updateInventoryUsageRule } from '../inventory.usage-rules.update'
import { buildInventoryUsageRule, formatInventoryUsageRuleQuantity } from '../inventory.usage-rules.utils'

const actor = { $type: 'staff', uid: 'uid-1', email: 'test@example.com' } as const
const now = new Date('2026-05-01T00:00:00.000Z')

function createQuantityItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
    return {
        id: 'item-1',
        name: 'Party pies',
        inventoryKey: 'party-base:partyPies',
        category: 'party-food',
        status: 'active',
        $trackingMode: 'quantity',
        baseUnit: 'each',
        runningLowThreshold: 10,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    } as InventoryItem
}

function createQualitativeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
    return {
        id: 'item-qualitative',
        name: 'Glitter',
        inventoryKey: 'party-base:glitter',
        category: 'party-food',
        status: 'active',
        $trackingMode: 'qualitative',
        baseUnit: 'tub',
        createdAt: now,
        updatedAt: now,
        ...overrides,
    } as InventoryItem
}

function createStockLevel(overrides: Partial<InventoryStockLevel> = {}): InventoryStockLevel {
    const location = overrides.location ?? 'balwyn'
    const itemId = overrides.itemId ?? 'item-1'

    return {
        id: getInventoryStockLevelId(location, itemId),
        itemId,
        location,
        stocked: true,
        measurement: { $type: 'quantity', quantity: 12 },
        updatedAt: now,
        ...overrides,
    }
}

function createMovement(overrides: Partial<InventoryStockMovement> = {}): InventoryStockMovement {
    return {
        id: 'movement-1',
        itemId: 'item-1',
        location: 'balwyn',
        $type: 'counted',
        quantityBefore: null,
        quantityAfter: 12,
        createdAt: now,
        createdBy: actor,
        ...overrides,
    } as InventoryStockMovement
}

function createUsageRule(overrides: Partial<InventoryUsageRule> = {}): InventoryUsageRule {
    return {
        id: 'rule-1',
        $type: 'party-base',
        inventoryKey: 'party-base:partyPies',
        label: 'Party pies',
        status: 'active',
        quantity: { $operation: 'per-child', quantityPerChild: 1 },
        createdAt: now,
        updatedAt: now,
        ...overrides,
    } as InventoryUsageRule
}

function createBooking(overrides: Partial<Booking> = {}): Booking {
    const additions: Record<Addition, boolean> = {
        chickenNuggets: false,
        fairyBread: false,
        fruitPlatter: false,
        frankfurts: false,
        sandwichPlatter: false,
        vegetarianQuiche: false,
        watermelonPlatter: false,
        wedges: false,
        dinosaurFizzPartyPack: false,
        unicornFizzPartyPack: false,
        glutenFreeFairyBread: false,
        vegetarianSpringRolls: false,
        veggiePlatter: false,
        potatoGems: false,
        lollyBags: false,
        grazingPlatterMedium: false,
        grazingPlatterLarge: false,
        volcanoPartyPack: false,
        dinosaurBathBombPartyPack: false,
        lipBalmPartyPack: false,
        slimePartyPack: false,
    }

    return {
        ...additions,
        parentFirstName: 'Parent',
        parentLastName: 'Person',
        parentEmail: 'parent@example.com',
        parentMobile: '0400000000',
        childName: 'Charlie',
        childAge: '7',
        location: 'balwyn',
        type: 'studio',
        partyLength: '1.5',
        address: '',
        numberOfChildren: '12 - 15',
        notes: '',
        creation1: undefined,
        creation2: undefined,
        creation3: undefined,
        menu: undefined,
        cakeFlavour: undefined,
        questions: '',
        funFacts: '',
        partyFormFilledIn: true,
        sendConfirmationEmail: true,
        oldPrices: false,
        includesFood: true,
        useRsvpSystem: undefined,
        invitationId: undefined,
        invitationOwnerUid: undefined,
        dateTime: now,
        ...overrides,
    } as Booking
}

function configureInventoryListMocks(input: {
    bookings?: { id: string; booking: Booking }[]
    rules?: InventoryUsageRule[]
    items?: InventoryItem[]
    stockLevels?: InventoryStockLevel[]
}) {
    mockDatabaseClient.listPartyBookingsForInventoryShoppingList = async () => input.bookings ?? []
    mockDatabaseClient.listInventoryUsageRules = async () => input.rules ?? []
    mockDatabaseClient.listInventoryItems = async () => input.items ?? []
    mockDatabaseClient.listInventoryStockLevels = async () => input.stockLevels ?? []
}

function getWarningsOfType<T extends InventoryShoppingListWarning['$type']>(
    warnings: InventoryShoppingListWarning[],
    type: T
) {
    return warnings.filter((warning) => warning.$type === type)
}

describe('inventory core', () => {
    afterEach(() => {
        resetDatabaseClientMock()
    })

    describe('items', () => {
        it('creates a quantity item and stock level for every studio', async () => {
            let savedItems: InventoryItem[] = []
            let savedStockLevels: InventoryStockLevel[] = []
            mockDatabaseClient.createInventoryItemId = async () => 'item-1'
            mockDatabaseClient.setInventoryDocuments = async (input) => {
                savedItems = input.items ?? []
                savedStockLevels = input.stockLevels ?? []
            }
            mockDatabaseClient.getInventoryItem = async () => savedItems[0]

            const result = await createInventoryItem({
                $trackingMode: 'quantity',
                name: 'Party pies',
                inventoryKey: 'party-base:partyPies',
                category: 'party-food',
                status: 'active',
                baseUnit: 'each',
                runningLowThreshold: 10,
            })

            strictEqual(result.id, 'item-1')
            strictEqual(savedStockLevels.length, STUDIOS.length)
            deepStrictEqual(savedStockLevels[0].measurement, { $type: 'quantity', quantity: null })
            strictEqual(
                savedStockLevels.every((stock) => stock.stocked),
                true
            )
        })

        it('creates qualitative stock levels for qualitative items', async () => {
            let savedStockLevels: InventoryStockLevel[] = []
            mockDatabaseClient.createInventoryItemId = async () => 'item-1'
            mockDatabaseClient.setInventoryDocuments = async (input) => {
                savedStockLevels = input.stockLevels ?? []
            }
            mockDatabaseClient.getInventoryItem = async () => createQualitativeItem({ id: 'item-1' })

            await createInventoryItem({
                $trackingMode: 'qualitative',
                name: 'Glitter',
                category: 'party-food',
                status: 'active',
                baseUnit: 'tub',
            })

            deepStrictEqual(savedStockLevels[0].measurement, { $type: 'qualitative', level: 'unknown' })
        })

        it('lists items with optional filters and default undefined input', async () => {
            const inputs: unknown[] = []
            mockDatabaseClient.listInventoryItems = async (input) => {
                inputs.push(input)
                return [createQuantityItem()]
            }

            await listInventoryItems(undefined)
            const result = await listInventoryItems({ includeArchived: true, category: 'party-food' })

            strictEqual(result.length, 1)
            deepStrictEqual(inputs, [
                { includeArchived: undefined, category: undefined },
                { includeArchived: true, category: 'party-food' },
            ])
        })

        it('updates items and deletes inventoryKey when cleared', async () => {
            let update: Partial<InventoryItem> | undefined
            mockDatabaseClient.updateInventoryItem = async (_itemId, item) => {
                update = item
            }
            mockDatabaseClient.getInventoryItem = async () => createQuantityItem({ inventoryKey: undefined })

            const result = await updateInventoryItem({
                itemId: 'item-1',
                item: {
                    $trackingMode: 'quantity',
                    inventoryKey: null,
                    baseUnit: 'each',
                    runningLowThreshold: null,
                },
            })

            strictEqual(result.inventoryKey, undefined)
            strictEqual(update?.inventoryKey, FieldValue.delete())
            ok(update?.updatedAt instanceof Date)
        })

        it('updates inventoryKey when provided', async () => {
            let update: Partial<InventoryItem> | undefined
            mockDatabaseClient.updateInventoryItem = async (_itemId, item) => {
                update = item
            }
            mockDatabaseClient.getInventoryItem = async () => createQuantityItem({ inventoryKey: 'party-base:newKey' })

            const result = await updateInventoryItem({
                itemId: 'item-1',
                item: {
                    name: 'New name',
                    inventoryKey: 'party-base:newKey',
                },
            })

            strictEqual(result.inventoryKey, 'party-base:newKey')
            strictEqual(update?.inventoryKey, 'party-base:newKey')
        })

        it('deletes the item and related stock documents', async () => {
            let deleted: unknown
            mockDatabaseClient.listInventoryStockLevels = async () => [createStockLevel({ id: 'stock-1' })]
            mockDatabaseClient.listInventoryStockMovements = async () => [createMovement({ id: 'movement-1' })]
            mockDatabaseClient.deleteInventoryDocuments = async (input) => {
                deleted = input
            }

            await deleteInventoryItem({ itemId: 'item-1' })

            deepStrictEqual(deleted, {
                itemIds: ['item-1'],
                stockLevelIds: ['stock-1'],
                stockMovementIds: ['movement-1'],
            })
        })
    })

    describe('stock', () => {
        it('lists stock and movements with default limit', async () => {
            const stockInputs: unknown[] = []
            const movementInputs: unknown[] = []
            mockDatabaseClient.listInventoryStockLevels = async (input) => {
                stockInputs.push(input)
                return [createStockLevel()]
            }
            mockDatabaseClient.listInventoryStockMovements = async (input) => {
                movementInputs.push(input)
                return [createMovement()]
            }

            await listInventoryStock(undefined)
            await listInventoryStock({ location: 'balwyn', itemId: 'item-1' })
            await listInventoryStockMovements(undefined)
            await listInventoryStockMovements({ location: 'balwyn', itemId: 'item-1', limit: 10 })

            deepStrictEqual(stockInputs, [
                { location: undefined, itemId: undefined },
                { location: 'balwyn', itemId: 'item-1' },
            ])
            deepStrictEqual(movementInputs, [
                { location: undefined, itemId: undefined, limit: 100 },
                { location: 'balwyn', itemId: 'item-1', limit: 10 },
            ])
        })

        it('sets stocked on an existing stock level', async () => {
            let update: unknown
            mockDatabaseClient.getInventoryStockLevel = async () => createStockLevel({ stocked: true })
            mockDatabaseClient.updateInventoryStockLevel = async (input) => {
                update = input
            }

            const result = await setInventoryStocked({ itemId: 'item-1', location: 'balwyn', stocked: false })

            strictEqual(result?.stocked, true)
            deepStrictEqual((update as { stockLevel: Partial<InventoryStockLevel> }).stockLevel.stocked, false)
        })

        it('rejects stocked changes for missing stock levels', async () => {
            mockDatabaseClient.getInventoryStockLevel = async () => undefined

            await rejects(setInventoryStocked({ itemId: 'item-1', location: 'balwyn', stocked: false }))
        })
    })

    describe('usage rules', () => {
        it('builds usage rules and quantity labels for every operation', () => {
            const base = buildInventoryUsageRule(
                {
                    $type: 'party-base',
                    name: 'partyPies',
                    label: '',
                    status: 'active',
                    quantity: { $operation: 'fixed', quantity: 2 },
                },
                { id: 'rule-1', now }
            )
            const addition = buildInventoryUsageRule(
                {
                    $type: 'party-addition',
                    name: 'chickenNuggets',
                    status: 'active',
                    quantity: { $operation: 'per-child', quantityPerChild: 1 },
                },
                { id: 'rule-2', now }
            )

            strictEqual(base.inventoryKey, 'party-base:partyPies')
            strictEqual(base.label, 'partyPies')
            strictEqual(addition.label, 'Chicken Nuggets')
            strictEqual(addition.$type, 'party-addition')
            strictEqual(formatInventoryUsageRuleQuantity({ $operation: 'fixed', quantity: 2 }), '2 per booking')
            strictEqual(
                formatInventoryUsageRuleQuantity({ $operation: 'per-child', quantityPerChild: 0.5 }),
                '0.5 per child'
            )
            strictEqual(
                formatInventoryUsageRuleQuantity({
                    $operation: 'fixed-plus-per-child',
                    fixedQuantity: 1,
                    quantityPerChild: 2,
                }),
                '1 per booking + 2 per child'
            )
        })

        it('creates, updates, lists, and deletes usage rules', async () => {
            const savedRules: InventoryUsageRule[] = []
            mockDatabaseClient.createInventoryUsageRuleId = async () => 'rule-1'
            mockDatabaseClient.setInventoryDocuments = async (input) => {
                savedRules.push(...(input.usageRules ?? []))
            }
            mockDatabaseClient.getInventoryUsageRule = async () => savedRules[savedRules.length - 1]
            mockDatabaseClient.listInventoryUsageRules = async (input) => [
                createUsageRule({ status: input?.includeArchived ? 'archived' : 'active' }),
            ]
            let deletedRuleId = ''
            mockDatabaseClient.deleteInventoryUsageRule = async (ruleId) => {
                deletedRuleId = ruleId
            }

            const created = await createInventoryUsageRule({
                $type: 'party-food-package',
                name: 'fairyBread',
                label: 'Fairy bread',
                status: 'active',
                quantity: { $operation: 'fixed', quantity: 1 },
            })
            const listed = await listInventoryUsageRules({ includeArchived: true })
            const updated = await updateInventoryUsageRule({
                ruleId: 'rule-1',
                rule: {
                    $type: 'party-food-package',
                    name: 'fairyBread',
                    status: 'archived',
                    quantity: { $operation: 'fixed', quantity: 2 },
                },
            })
            await deleteInventoryUsageRule({ ruleId: 'rule-1' })

            strictEqual(created.inventoryKey, 'party-food-package:fairyBread')
            strictEqual(listed[0].status, 'archived')
            strictEqual(updated.createdAt, created.createdAt)
            strictEqual(deletedRuleId, 'rule-1')
        })
    })

    describe('shopping list', () => {
        it('generates a master shopping list using the high end of child-count ranges', async () => {
            configureInventoryListMocks({
                bookings: [
                    { id: 'booking-1', booking: createBooking({ numberOfChildren: '12 - 15', location: 'balwyn' }) },
                    { id: 'booking-2', booking: createBooking({ numberOfChildren: '26', location: 'kingsville' }) },
                ],
                rules: [createUsageRule({ quantity: { $operation: 'per-child', quantityPerChild: 1 } })],
                items: [createQuantityItem()],
                stockLevels: [
                    createStockLevel({ location: 'balwyn', measurement: { $type: 'quantity', quantity: 10 } }),
                    createStockLevel({ location: 'kingsville', measurement: { $type: 'quantity', quantity: 100 } }),
                ],
            })

            const result = await generateInventoryShoppingList({
                location: 'master',
                startDate: new Date('2026-05-01T00:00:00.000Z'),
                endDate: new Date('2026-05-08T00:00:00.000Z'),
            })

            const balwynLine = result.studioReports.find((report) => report.location === 'balwyn')?.lines[0]
            const kingsvilleLine = result.studioReports.find((report) => report.location === 'kingsville')?.lines[0]
            strictEqual(result.bookingCount, 2)
            strictEqual(balwynLine?.requiredQuantity, 15)
            strictEqual(balwynLine?.suggestedPurchaseQuantity, 5)
            strictEqual(kingsvilleLine?.requiredQuantity, 26)
            strictEqual(kingsvilleLine?.suggestedPurchaseQuantity, 0)
        })

        it('applies fixed, per-child, fixed-plus-per-child, food, and addition rules', async () => {
            configureInventoryListMocks({
                bookings: [
                    {
                        id: 'booking-1',
                        booking: createBooking({
                            numberOfChildren: '10',
                            includesFood: true,
                            chickenNuggets: true,
                        }),
                    },
                ],
                rules: [
                    createUsageRule({ id: 'fixed', quantity: { $operation: 'fixed', quantity: 2 } }),
                    createUsageRule({
                        id: 'food',
                        $type: 'party-food-package',
                        inventoryKey: 'party-base:partyPies',
                        quantity: { $operation: 'fixed-plus-per-child', fixedQuantity: 1, quantityPerChild: 0.5 },
                    }),
                    createUsageRule({
                        id: 'addition',
                        $type: 'party-addition',
                        addition: 'chickenNuggets',
                        inventoryKey: 'party-base:partyPies',
                        quantity: { $operation: 'per-child', quantityPerChild: 1 },
                    }),
                ],
                items: [createQuantityItem()],
                stockLevels: [createStockLevel({ measurement: { $type: 'quantity', quantity: 0 } })],
            })

            const result = await generateInventoryShoppingList({
                location: 'balwyn',
                startDate: now,
                endDate: new Date('2026-05-02T00:00:00.000Z'),
            })

            strictEqual(result.studioReports[0].lines[0].requiredQuantity, 18)
            strictEqual(result.studioReports[0].lines[0].sourceBreakdown.length, 3)
        })

        it('aggregates duplicate sources and uses default rule labels', async () => {
            configureInventoryListMocks({
                bookings: [
                    {
                        id: 'booking-1',
                        booking: createBooking({
                            childName: '',
                            numberOfChildren: '2',
                            includesFood: true,
                            chickenNuggets: true,
                        }),
                    },
                    {
                        id: 'booking-2',
                        booking: createBooking({ numberOfChildren: '3', includesFood: true, chickenNuggets: true }),
                    },
                ],
                rules: [
                    createUsageRule({ id: 'base', label: undefined, quantity: { $operation: 'fixed', quantity: 1 } }),
                    createUsageRule({
                        id: 'food',
                        label: undefined,
                        $type: 'party-food-package',
                        inventoryKey: 'party-base:partyPies',
                        quantity: { $operation: 'fixed', quantity: 1 },
                    }),
                    createUsageRule({
                        id: 'addition',
                        label: undefined,
                        $type: 'party-addition',
                        addition: 'chickenNuggets',
                        inventoryKey: 'party-base:partyPies',
                        quantity: { $operation: 'fixed', quantity: 1 },
                    }),
                ],
                items: [createQuantityItem(), createQuantityItem({ id: 'no-key', inventoryKey: undefined })],
                stockLevels: [createStockLevel({ measurement: { $type: 'quantity', quantity: 0 } })],
            })

            const result = await generateInventoryShoppingList({
                location: 'balwyn',
                startDate: now,
                endDate: new Date('2026-05-02T00:00:00.000Z'),
            })

            const line = result.studioReports[0].lines[0]
            strictEqual(line.requiredQuantity, 6)
            deepStrictEqual(
                line.sourceBreakdown.map((source) => ({
                    label: source.label,
                    requiredQuantity: source.requiredQuantity,
                    bookingCount: source.bookingCount,
                })),
                [
                    { label: 'Base party', requiredQuantity: 2, bookingCount: 2 },
                    { label: 'Party food package', requiredQuantity: 2, bookingCount: 2 },
                    { label: 'Chicken Nuggets', requiredQuantity: 2, bookingCount: 2 },
                ]
            )
        })

        it('skips rules that do not apply or calculate zero required quantity', async () => {
            configureInventoryListMocks({
                bookings: [
                    {
                        id: 'booking-1',
                        booking: createBooking({
                            numberOfChildren: '',
                            includesFood: false,
                            chickenNuggets: false,
                        }),
                    },
                ],
                rules: [
                    createUsageRule({
                        id: 'food',
                        $type: 'party-food-package',
                        inventoryKey: 'party-base:partyPies',
                        quantity: { $operation: 'fixed', quantity: 1 },
                    }),
                    createUsageRule({
                        id: 'addition',
                        $type: 'party-addition',
                        addition: 'chickenNuggets',
                        inventoryKey: 'party-base:partyPies',
                        quantity: { $operation: 'fixed', quantity: 1 },
                    }),
                    createUsageRule({
                        id: 'per-child',
                        inventoryKey: 'party-base:partyPies',
                        quantity: { $operation: 'per-child', quantityPerChild: 1 },
                    }),
                    createUsageRule({
                        id: 'fixed-plus-per-child',
                        inventoryKey: 'party-base:partyPies',
                        quantity: { $operation: 'fixed-plus-per-child', fixedQuantity: 0, quantityPerChild: 1 },
                    }),
                ],
                items: [createQuantityItem()],
                stockLevels: [createStockLevel()],
            })

            const result = await generateInventoryShoppingList({
                location: 'balwyn',
                startDate: now,
                endDate: new Date('2026-05-02T00:00:00.000Z'),
            })

            strictEqual(result.studioReports[0].lines.length, 0)
        })

        it('emits global and booking warnings for no rules and invalid child counts', async () => {
            configureInventoryListMocks({
                bookings: [
                    { id: 'empty', booking: createBooking({ numberOfChildren: '' }) },
                    { id: 'missing', booking: createBooking({ numberOfChildren: undefined as unknown as string }) },
                    { id: 'bad', booking: createBooking({ numberOfChildren: 'many' }) },
                    { id: 'negative', booking: createBooking({ numberOfChildren: '-1' }) },
                ],
                rules: [],
            })

            const result = await generateInventoryShoppingList({ location: 'balwyn', startDate: now, endDate: now })

            strictEqual(getWarningsOfType(result.warnings, 'no-active-rules').length, 1)
            strictEqual(getWarningsOfType(result.warnings, 'invalid-child-count').length, 4)
        })

        it('rejects shopping-list date ranges where end is not after start', () => {
            strictEqual(
                inventoryShoppingListInputSchema.safeParse({ location: 'balwyn', startDate: now, endDate: now })
                    .success,
                false
            )
        })

        it('emits item and stock warnings for problematic inventory mappings', async () => {
            const duplicateA = createQuantityItem({ id: 'duplicate-a', name: 'Duplicate A', inventoryKey: 'dup' })
            const duplicateB = createQuantityItem({ id: 'duplicate-b', name: 'Duplicate B', inventoryKey: 'dup' })
            configureInventoryListMocks({
                bookings: [{ id: 'booking-1', booking: createBooking({ numberOfChildren: '1' }) }],
                rules: [
                    createUsageRule({ id: 'missing', inventoryKey: 'missing' }),
                    createUsageRule({ id: 'duplicate', inventoryKey: 'dup' }),
                    createUsageRule({ id: 'qualitative', inventoryKey: 'qual' }),
                    createUsageRule({ id: 'missing-stock', inventoryKey: 'missing-stock' }),
                    createUsageRule({ id: 'unused', inventoryKey: 'unused' }),
                    createUsageRule({ id: 'unknown', inventoryKey: 'unknown' }),
                ],
                items: [
                    duplicateA,
                    duplicateB,
                    createQualitativeItem({ id: 'qual', inventoryKey: 'qual' }),
                    createQuantityItem({ id: 'missing-stock', inventoryKey: 'missing-stock' }),
                    createQuantityItem({ id: 'unused', inventoryKey: 'unused' }),
                    createQuantityItem({ id: 'unknown', inventoryKey: 'unknown' }),
                    createQuantityItem({ id: 'archived', inventoryKey: 'missing', status: 'archived' }),
                ],
                stockLevels: [
                    createStockLevel({ itemId: 'qual', measurement: { $type: 'qualitative', level: 'low' } }),
                    createStockLevel({
                        itemId: 'unused',
                        stocked: false,
                        measurement: { $type: 'quantity', quantity: 10 },
                    }),
                    createStockLevel({ itemId: 'unknown', measurement: { $type: 'quantity', quantity: null } }),
                ],
            })

            const result = await generateInventoryShoppingList({ location: 'balwyn', startDate: now, endDate: now })
            const warnings = result.studioReports[0].warnings

            strictEqual(getWarningsOfType(warnings, 'missing-inventory-item').length, 1)
            strictEqual(getWarningsOfType(warnings, 'duplicate-inventory-items').length, 1)
            strictEqual(getWarningsOfType(warnings, 'qualitative-item-required').length, 1)
            strictEqual(getWarningsOfType(warnings, 'missing-stock-level').length, 1)
            strictEqual(getWarningsOfType(warnings, 'unused-at-location').length, 1)
            strictEqual(getWarningsOfType(warnings, 'unknown-stock-quantity').length, 1)
            strictEqual(result.studioReports[0].lines.length, 2)
        })
    })

    describe('custom schema behaviour', () => {
        it('runs custom studio/addition predicates and date-range refinement', () => {
            strictEqual(studioSchema.safeParse('balwyn').success, true)
            strictEqual(studioSchema.safeParse('not-a-studio').success, false)
            strictEqual(additionSchema.safeParse('chickenNuggets').success, true)
            strictEqual(additionSchema.safeParse('not-an-addition').success, false)
            strictEqual(
                inventoryShoppingListInputSchema.safeParse({
                    location: 'master',
                    startDate: now,
                    endDate: new Date('2026-05-02T00:00:00.000Z'),
                }).success,
                true
            )
            strictEqual(
                inventoryShoppingListInputSchema.safeParse({ location: 'balwyn', startDate: now, endDate: now })
                    .success,
                false
            )
        })
    })
})
