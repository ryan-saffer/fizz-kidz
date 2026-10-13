import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'assert'

import { mockDatabaseClient, resetDatabaseClientMock } from '@test-support/database-client.mock'
import { FieldValue } from 'firebase-admin/firestore'
import { afterEach, beforeEach, describe, it, vi } from 'vite-plus/test'

import { getInventoryStockLevelId } from '@fizz-kidz/core'
import type { InventoryItem, InventoryStockLevel, InventoryStockMovement } from '@fizz-kidz/core'

import { getInventoryAlertCc, getInventoryAlerts, sendInventoryAlerts } from '../inventory.alerts'
import { updateInventoryItem } from '../inventory.items.update'
import { inventoryItemInputSchema } from '../inventory.schemas'
import { listInventorySquareOptions } from '../inventory.square-options.list'
import { countInventoryStock, countInventoryStockInputSchema } from '../inventory.stock.count'
import { receiveInventoryStock, receiveInventoryStockInputSchema } from '../inventory.stock.receive'
import { removeInventoryStock } from '../inventory.stock.remove'
import { updateInventoryStockLevel } from '../inventory.stock.update-level'
import { writeInventoryStockChanges } from '../inventory.stock.write'
import { buildInventoryUsageRule, formatInventoryUsageRuleQuantity } from '../inventory.usage-rules.utils'

import type { InventoryStockWrite } from '../inventory.alerts'

const mocks = vi.hoisted(() => ({
    env: 'prod' as 'prod' | 'dev',
    sendEmail: vi.fn(),
    logError: vi.fn(),
    getCatalogItemOptions: vi.fn(),
}))

vi.mock('@/app/init/firebase', () => ({
    get env() {
        return mocks.env
    },
}))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))
vi.mock('@/integrations/square/core/get-catalog-item-options', () => ({
    getCatalogItemOptions: mocks.getCatalogItemOptions,
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

function level(itemId: string, value: 'unknown' | 'out' | 'low' | 'medium' | 'high'): InventoryStockLevel {
    return { ...stock(itemId, null), measurement: { $type: 'qualitative', level: value } }
}

function mockTransaction(items: InventoryItem[], stockLevels: InventoryStockLevel[]) {
    const written: { stockLevel: InventoryStockLevel; movement: InventoryStockMovement }[] = []
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

describe('inventory stock writes', () => {
    beforeEach(() => {
        mocks.env = 'prod'
        mocks.sendEmail.mockReset()
        mocks.logError.mockReset()
        mocks.getCatalogItemOptions.mockReset()
    })

    afterEach(() => {
        resetDatabaseClientMock()
    })

    describe('writeInventoryStockChanges', () => {
        it('refuses the same item twice in one change', async () => {
            await rejects(
                writeInventoryStockChanges({
                    location: 'werribee',
                    actor,
                    changes: [
                        { itemId: 'nuggets', change: { $type: 'received', quantity: 1 } },
                        { itemId: 'nuggets', change: { $type: 'received', quantity: 2 } },
                    ],
                }),
                /Each item can only appear once/
            )
        })
    })

    describe('input schemas', () => {
        it('rejects duplicate items in a delivery or a count', () => {
            const lines = [
                { itemId: 'a', quantity: 1 },
                { itemId: 'a', quantity: 2 },
            ]
            strictEqual(receiveInventoryStockInputSchema.safeParse({ location: 'werribee', lines }).success, false)
            strictEqual(countInventoryStockInputSchema.safeParse({ location: 'werribee', lines }).success, false)
            strictEqual(
                receiveInventoryStockInputSchema.safeParse({ location: 'werribee', lines: [lines[0]] }).success,
                true
            )
            strictEqual(
                countInventoryStockInputSchema.safeParse({ location: 'werribee', lines: [lines[0]] }).success,
                true
            )
        })

        it('requires linked categories to be counted and linked, and cake supplies to say how much is used', () => {
            const base = { name: 'Thing', baseUnit: 'each', runningLowThreshold: null }
            const issues = (input: unknown) => {
                const result = inventoryItemInputSchema.safeParse(input)
                return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
            }

            deepStrictEqual(issues({ ...base, $trackingMode: 'quantity', category: 'party-food' }), [])
            deepStrictEqual(issues({ ...base, $trackingMode: 'quantity', category: 'cakes' }), [
                'squareCatalogObjectId',
            ])
            deepStrictEqual(issues({ name: 'Cake', $trackingMode: 'qualitative', category: 'cakes' }), [
                'squareCatalogObjectId',
            ])
            deepStrictEqual(
                issues({ ...base, $trackingMode: 'quantity', category: 'cakes', squareCatalogObjectId: 'SQ' }),
                []
            )
            deepStrictEqual(
                issues({ ...base, $trackingMode: 'quantity', category: 'cake-supplies', squareCatalogObjectId: 'SQ' }),
                ['usedPer']
            )
            deepStrictEqual(
                issues({
                    ...base,
                    $trackingMode: 'quantity',
                    category: 'cake-supplies',
                    squareCatalogObjectId: 'SQ',
                    usedPer: 'child',
                }),
                []
            )
        })
    })

    describe('stock changes', () => {
        it('receives and counts without a note or reason', async () => {
            const written = mockTransaction([nuggets], [stock('nuggets', 30)])

            const received = await receiveInventoryStock(
                { location: 'werribee', lines: [{ itemId: 'nuggets', quantity: 5 }], note: '' },
                actor
            )
            const counted = await countInventoryStock(
                { location: 'werribee', lines: [{ itemId: 'nuggets', quantity: 40 }], reason: '' },
                actor
            )

            deepStrictEqual(received[0].measurement, { $type: 'quantity', quantity: 35 })
            deepStrictEqual(counted[0].measurement, { $type: 'quantity', quantity: 40 })
            deepStrictEqual(
                written.map(({ movement }) => movement.reason),
                [undefined, undefined]
            )
        })

        it('removes stock with a reason', async () => {
            const written = mockTransaction([nuggets], [stock('nuggets', 30)])

            const result = await removeInventoryStock(
                { location: 'werribee', itemId: 'nuggets', quantity: 4, reason: 'Dropped' },
                actor
            )

            deepStrictEqual(result.measurement, { $type: 'quantity', quantity: 26 })
            strictEqual(written[0].movement.$type, 'removed')
            strictEqual(written[0].movement.reason, 'Dropped')
        })

        it('updates a qualitative stock level', async () => {
            const written = mockTransaction([glitter], [level('glitter', 'high')])

            const result = await updateInventoryStockLevel(
                { location: 'werribee', itemId: 'glitter', level: 'medium' },
                actor
            )

            deepStrictEqual(result.measurement, { $type: 'qualitative', level: 'medium' })
            strictEqual(written[0].movement.$type, 'level-updated')
            strictEqual(mocks.sendEmail.mock.calls.length, 0)
        })
    })

    describe('alerts', () => {
        function write(
            item: InventoryItem,
            before: InventoryStockLevel | undefined,
            stockLevel: InventoryStockLevel,
            movement: Partial<InventoryStockMovement>
        ): InventoryStockWrite {
            return {
                item,
                before,
                stockLevel,
                movement: {
                    id: 'm',
                    itemId: item.id,
                    location: 'werribee',
                    createdAt: now,
                    createdBy: actor,
                    ...movement,
                } as InventoryStockMovement,
            }
        }

        it('describes a system count mismatch with no reason', () => {
            const alerts = getInventoryAlerts([
                write(unicornCake, stock('unicorn', 3), stock('unicorn', 2), {
                    $type: 'counted',
                    quantityBefore: 3,
                    quantityAfter: 2,
                    createdBy: { $type: 'system' },
                } as Partial<InventoryStockMovement>),
            ])

            strictEqual(alerts[0].title, "Unicorn cake: count didn't match")
            ok(alerts[0].detail.includes('Reason given: "none"'))
            ok(alerts[0].detail.includes('Counted by the system'))
        })

        it('describes a qualitative item running low', () => {
            const alerts = getInventoryAlerts([
                write(glitter, level('glitter', 'high'), level('glitter', 'low'), {
                    $type: 'level-updated',
                    levelBefore: 'high',
                    levelAfter: 'low',
                } as Partial<InventoryStockMovement>),
            ])

            deepStrictEqual(alerts, [{ title: 'Glitter: running low', detail: 'Stock level is low. Time to reorder.' }])
        })

        it('describes a counted item running low', () => {
            const alerts = getInventoryAlerts([
                write(nuggets, stock('nuggets', 30), stock('nuggets', 5), {
                    $type: 'removed',
                    quantity: 25,
                    quantityBefore: 30,
                    quantityAfter: 5,
                } as Partial<InventoryStockMovement>),
            ])

            deepStrictEqual(alerts, [{ title: 'Chicken nuggets: running low', detail: '5 left. Time to reorder.' }])
        })

        it('ignores archived or unstocked items for running low', () => {
            const movement = { $type: 'removed', quantity: 25 } as Partial<InventoryStockMovement>
            const archived = { ...nuggets, status: 'archived' } satisfies InventoryItem
            const unstocked = { ...stock('nuggets', 5), stocked: false }

            deepStrictEqual(
                getInventoryAlerts([write(archived, stock('nuggets', 30), stock('nuggets', 5), movement)]),
                []
            )
            deepStrictEqual(getInventoryAlerts([write(nuggets, stock('nuggets', 30), unstocked, movement)]), [])
        })

        it('logs and swallows a failed alert email', async () => {
            mocks.sendEmail.mockRejectedValueOnce(new Error('sendgrid down'))

            await sendInventoryAlerts('werribee', [
                write(nuggets, stock('nuggets', 30), stock('nuggets', 5), {
                    $type: 'removed',
                } as Partial<InventoryStockMovement>),
            ])

            strictEqual(mocks.logError.mock.calls.length, 1)
            strictEqual(mocks.logError.mock.calls[0][0], "error sending inventory alert for 'werribee'")
        })

        it('copies nobody outside prod', () => {
            mocks.env = 'dev'
            deepStrictEqual(getInventoryAlertCc('geelong'), [])
        })
    })

    describe('updateInventoryItem', () => {
        let update: Partial<InventoryItem> | undefined

        beforeEach(() => {
            update = undefined
            mockDatabaseClient.updateInventoryItem = async (_itemId, item) => {
                update = item
            }
            mockDatabaseClient.getInventoryItem = async (itemId) => ({ ...unicornCake, id: itemId })
        })

        it('sets a Square link and usage', async () => {
            await updateInventoryItem({
                itemId: 'cups',
                item: {
                    $trackingMode: 'quantity',
                    category: 'cake-supplies',
                    baseUnit: 'cup',
                    runningLowThreshold: null,
                    squareCatalogObjectId: 'SQUARE_CUPS',
                    usedPer: 'child',
                },
            })

            strictEqual((update as Record<string, unknown>).squareCatalogObjectId, 'SQUARE_CUPS')
            strictEqual((update as Record<string, unknown>).usedPer, 'child')
        })

        it('clears a Square link and usage', async () => {
            await updateInventoryItem({
                itemId: 'cups',
                item: {
                    $trackingMode: 'quantity',
                    baseUnit: 'cup',
                    runningLowThreshold: null,
                    squareCatalogObjectId: null,
                    usedPer: null,
                },
            })

            strictEqual((update as Record<string, unknown>).squareCatalogObjectId, FieldValue.delete())
            strictEqual((update as Record<string, unknown>).usedPer, FieldValue.delete())
        })
    })

    describe('usage rule utils', () => {
        it('labels addition rules with the addition name and formats every quantity', () => {
            const rule = buildInventoryUsageRule(
                {
                    $type: 'party-addition',
                    name: 'chickenNuggets',
                    status: 'active',
                    quantity: { $operation: 'fixed', quantity: 1 },
                },
                { id: 'rule-1', now }
            )

            strictEqual(rule.$type, 'party-addition')
            ok(rule.label.length > 0)
            strictEqual(formatInventoryUsageRuleQuantity({ $operation: 'fixed', quantity: 2 }), '2 per booking')
            strictEqual(
                formatInventoryUsageRuleQuantity({ $operation: 'per-child', quantityPerChild: 1 }),
                '1 per child'
            )
            strictEqual(
                formatInventoryUsageRuleQuantity({
                    $operation: 'fixed-plus-per-child',
                    fixedQuantity: 3,
                    quantityPerChild: 1,
                }),
                '3 per booking + 1 per child'
            )
        })

        it('throws on an unknown quantity operation', () => {
            throws(() => formatInventoryUsageRuleQuantity({ $operation: 'mystery' } as never))
        })
    })

    describe('listInventorySquareOptions', () => {
        it('lists cake designs, paid serving and candle options, and take-home bags', async () => {
            const { PARTY_CAKE_SQUARE_CATALOG } = await import('@fizz-kidz/core')
            const catalog = PARTY_CAKE_SQUARE_CATALOG.prod
            const option = (id: string, name: string, priceCents = 0) => ({ id, name, priceCents })
            mocks.getCatalogItemOptions.mockImplementation(async (itemId: string) =>
                itemId === catalog.itemId
                    ? {
                          variations: [],
                          modifierLists: new Map([
                              [catalog.designListId, { modifiers: [option('design-1', 'Unicorn')] }],
                              [
                                  catalog.servingListId,
                                  {
                                      modifiers: [
                                          option('serve-own', 'Bring my own'),
                                          option('serve-cups', 'Cups', 500),
                                      ],
                                  },
                              ],
                          ]),
                      }
                    : { variations: [option('bag-1', 'Lolly bag')], modifierLists: new Map() }
            )

            const options = await listInventorySquareOptions()

            deepStrictEqual(options, [
                { id: 'design-1', name: 'Unicorn', category: 'cakes' },
                { id: 'serve-cups', name: 'Serving: Cups', category: 'cake-supplies' },
                { id: 'bag-1', name: 'Lolly bag', category: 'take-home-bags' },
            ])
        })
    })
})
