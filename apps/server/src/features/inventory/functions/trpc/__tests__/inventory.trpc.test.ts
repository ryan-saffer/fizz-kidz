import { deepStrictEqual, rejects, strictEqual } from 'assert'

import { mockDatabaseClient, resetDatabaseClientMock } from '@test-support/database-client.mock'
import { afterEach, beforeEach, describe, it, vi } from 'vite-plus/test'

import type { AuthUser, Role, StudioOrMaster } from '@fizz-kidz/core'

import { inventoryRouter } from '../inventory.trpc'

const mocks = vi.hoisted(() => {
    const calls: { name: string; args: unknown[] }[] = []
    return {
        calls,
        stub:
            (name: string) =>
            async (...args: unknown[]) => {
                calls.push({ name, args })
                return name
            },
    }
})

vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/acuity/acuity.client', () => ({ AcuityClient: {} }))
vi.mock('@/shared/runtime/is-using-emulator', () => ({ isUsingEmulator: () => false }))
vi.mock('firebase-functions/v2', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    logger: { debug: () => {}, error: () => {} },
}))
vi.mock('firebase-admin/auth', () => ({
    getAuth: () => ({
        verifyIdToken: async (token: string) => {
            if (!token) throw new Error('no token')
            return { uid: token, email: `${token}@example.com` }
        },
    }),
}))

vi.mock('@/features/inventory/core/inventory.items.create', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    createInventoryItem: mocks.stub('createItem'),
}))
vi.mock('@/features/inventory/core/inventory.items.delete', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    deleteInventoryItem: mocks.stub('deleteItem'),
}))
vi.mock('@/features/inventory/core/inventory.items.list', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    listInventoryItems: mocks.stub('listItems'),
}))
vi.mock('@/features/inventory/core/inventory.items.update', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    updateInventoryItem: mocks.stub('updateItem'),
}))
vi.mock('@/features/inventory/core/inventory.shopping-list.generate', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    generateInventoryShoppingList: mocks.stub('generateShoppingList'),
}))
vi.mock('@/features/inventory/core/inventory.square-options.list', () => ({
    listInventorySquareOptions: mocks.stub('listSquareOptions'),
}))
vi.mock('@/features/inventory/core/inventory.stock-movements.list', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    listInventoryStockMovements: mocks.stub('listMovements'),
}))
vi.mock('@/features/inventory/core/inventory.stock.count', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    countInventoryStock: mocks.stub('countStock'),
}))
vi.mock('@/features/inventory/core/inventory.stock.list', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    listInventoryStock: mocks.stub('listStock'),
}))
vi.mock('@/features/inventory/core/inventory.stock.receive', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    receiveInventoryStock: mocks.stub('receiveStock'),
}))
vi.mock('@/features/inventory/core/inventory.stock.remove', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    removeInventoryStock: mocks.stub('removeStock'),
}))
vi.mock('@/features/inventory/core/inventory.stock.set-stocked', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    setInventoryStocked: mocks.stub('setStocked'),
}))
vi.mock('@/features/inventory/core/inventory.stock.update-level', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    updateInventoryStockLevel: mocks.stub('updateStockLevel'),
}))
vi.mock('@/features/inventory/core/inventory.usage-rules.create', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    createInventoryUsageRule: mocks.stub('createUsageRule'),
}))
vi.mock('@/features/inventory/core/inventory.usage-rules.delete', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    deleteInventoryUsageRule: mocks.stub('deleteUsageRule'),
}))
vi.mock('@/features/inventory/core/inventory.usage-rules.list', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    listInventoryUsageRules: mocks.stub('listUsageRules'),
}))
vi.mock('@/features/inventory/core/inventory.usage-rules.update', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    updateInventoryUsageRule: mocks.stub('updateUsageRule'),
}))

const actor = { $type: 'staff', uid: 'uid-1', email: 'uid-1@example.com' }
const usageRule = { $type: 'party-base', name: 'base', quantity: { $operation: 'fixed', quantity: 1 } } as const
const shoppingListDates = { startDate: new Date('2026-10-01'), endDate: new Date('2026-10-08') }

function staff(roles: Partial<Record<StudioOrMaster, Role>> | undefined): AuthUser {
    return { uid: 'uid-1', email: 'uid-1@example.com', imageUrl: null, accountType: 'staff', roles }
}

function signInAs(user: AuthUser | undefined) {
    mockDatabaseClient.getUser = async () => user
}

const caller = (token = 'uid-1') => inventoryRouter.createCaller({ authToken: token })

function trpcError(code: string, message?: RegExp) {
    return (err: { code?: string; message: string }) => {
        strictEqual(err.code, code)
        if (message) strictEqual(message.test(err.message), true, err.message)
        return true
    }
}

describe('inventory tRPC router', () => {
    beforeEach(() => {
        mocks.calls.length = 0
    })

    afterEach(() => {
        resetDatabaseClientMock()
    })

    it('routes every procedure to its core function, with the signed-in staff member as the actor', async () => {
        signInAs(staff({ master: 'super-admin' }))
        const api = caller()

        strictEqual(await api.listItems(), 'listItems')
        strictEqual(
            await api.createItem({
                $trackingMode: 'quantity',
                name: 'Pies',
                category: 'party-food',
                baseUnit: 'each',
                runningLowThreshold: null,
            }),
            'createItem'
        )
        strictEqual(await api.updateItem({ itemId: 'item-1', item: { name: 'Pies' } }), 'updateItem')
        strictEqual(await api.deleteItem({ itemId: 'item-1' }), 'deleteItem')
        strictEqual(await api.listSquareOptions(), 'listSquareOptions')
        strictEqual(await api.listStock({ location: 'werribee' }), 'listStock')
        strictEqual(
            await api.receiveStock({ location: 'werribee', lines: [{ itemId: 'item-1', quantity: 1 }] }),
            'receiveStock'
        )
        strictEqual(
            await api.countStock({ location: 'werribee', lines: [{ itemId: 'item-1', quantity: 1 }] }),
            'countStock'
        )
        strictEqual(
            await api.removeStock({ location: 'werribee', itemId: 'item-1', quantity: 1, reason: 'Broken' }),
            'removeStock'
        )
        strictEqual(
            await api.updateStockLevel({ location: 'werribee', itemId: 'item-1', level: 'low' }),
            'updateStockLevel'
        )
        strictEqual(await api.setStocked({ location: 'werribee', itemId: 'item-1', stocked: false }), 'setStocked')
        strictEqual(await api.listMovements(), 'listMovements')
        strictEqual(await api.listUsageRules(), 'listUsageRules')
        strictEqual(await api.createUsageRule(usageRule), 'createUsageRule')
        strictEqual(await api.updateUsageRule({ ruleId: 'rule-1', rule: usageRule }), 'updateUsageRule')
        strictEqual(await api.deleteUsageRule({ ruleId: 'rule-1' }), 'deleteUsageRule')
        strictEqual(
            await api.generateShoppingList({ location: 'master', ...shoppingListDates }),
            'generateShoppingList'
        )

        const actorCalls = mocks.calls.filter((call) =>
            ['receiveStock', 'countStock', 'removeStock', 'updateStockLevel'].includes(call.name)
        )
        strictEqual(actorCalls.length, 4)
        deepStrictEqual(
            actorCalls.map((call) => call.args[1]),
            [actor, actor, actor, actor]
        )
    })

    it('requires a signed-in user', async () => {
        await rejects(caller('').listItems(), trpcError('UNAUTHORIZED'))
    })

    it('requires a staff account with roles', async () => {
        const customer: AuthUser = { uid: 'uid-1', email: 'a@b.com', imageUrl: null, accountType: 'customer' }
        for (const user of [undefined, customer, staff(undefined)]) {
            signInAs(user)
            await rejects(caller().listItems(), trpcError('FORBIDDEN', /staff access/))
            await rejects(caller().listStock({ location: 'werribee' }), trpcError('FORBIDDEN', /staff access/))
            await rejects(
                caller().generateShoppingList({ location: 'master', ...shoppingListDates }),
                trpcError('FORBIDDEN', /staff access/)
            )
        }
        strictEqual(mocks.calls.length, 0)
    })

    describe('global permissions', () => {
        it('allows any role at any studio that has the permission', async () => {
            signInAs(staff({ balwyn: 'facilitator', werribee: 'manager' }))

            strictEqual(await caller().listItems(), 'listItems')
        })

        it('refuses when no role has the permission', async () => {
            signInAs(staff({ werribee: 'manager' }))

            await rejects(caller().listSquareOptions(), trpcError('FORBIDDEN', /'inventory:manage-items' permission$/))
        })
    })

    describe('location permissions', () => {
        it("uses the studio's role for that studio", async () => {
            signInAs(staff({ werribee: 'manager' }))

            strictEqual(await caller().listStock({ location: 'werribee' }), 'listStock')
            await rejects(
                caller().listStock({ location: 'balwyn' }),
                trpcError('FORBIDDEN', /'inventory:read' permission for 'balwyn'/)
            )
        })

        it('falls back to the master role', async () => {
            signInAs(staff({ werribee: 'facilitator', master: 'admin' }))

            strictEqual(
                await caller().updateStockLevel({ location: 'werribee', itemId: 'item-1', level: 'low' }),
                'updateStockLevel'
            )
        })

        it('refuses when neither the studio nor master role has the permission', async () => {
            signInAs(staff({ werribee: 'facilitator', master: 'facilitator' }))

            await rejects(
                caller().removeStock({ location: 'werribee', itemId: 'item-1', quantity: 1, reason: 'Broken' }),
                trpcError('FORBIDDEN', /'inventory:update-stock' permission for 'werribee'/)
            )
        })

        it('checks global permission when no studio is given', async () => {
            signInAs(staff({ werribee: 'manager' }))
            strictEqual(await caller().listMovements(), 'listMovements')
            strictEqual(
                await caller()
                    .listStock({ location: 'master' as never })
                    .catch(() => 'rejected'),
                'rejected'
            )

            signInAs(staff({ werribee: 'facilitator' }))
            await rejects(caller().listMovements({}), trpcError('FORBIDDEN', /'inventory:read' permission$/))
        })
    })

    describe('shopping list permissions', () => {
        it('needs the master role for the master list', async () => {
            signInAs(staff({ master: 'super-admin' }))
            strictEqual(
                await caller().generateShoppingList({ location: 'master', ...shoppingListDates }),
                'generateShoppingList'
            )

            signInAs(staff({ werribee: 'super-admin', master: 'admin' }))
            await rejects(
                caller().generateShoppingList({ location: 'master', ...shoppingListDates }),
                trpcError('FORBIDDEN', /'inventory:shopping-list' permission for 'master'/)
            )

            signInAs(staff({ werribee: 'super-admin' }))
            await rejects(
                caller().generateShoppingList({ location: 'master', ...shoppingListDates }),
                trpcError('FORBIDDEN', /for 'master'/)
            )
        })

        it("uses the studio's permission for a studio list", async () => {
            signInAs(staff({ werribee: 'super-admin' }))

            strictEqual(
                await caller().generateShoppingList({ location: 'werribee', ...shoppingListDates }),
                'generateShoppingList'
            )
            await rejects(
                caller().generateShoppingList({ location: 'balwyn', ...shoppingListDates }),
                trpcError('FORBIDDEN', /for 'balwyn'/)
            )
        })

        it('needs a studio or master location', async () => {
            signInAs(staff({ master: 'super-admin' }))

            await rejects(
                caller().generateShoppingList({ location: 'nowhere' as never, ...shoppingListDates }),
                trpcError('BAD_REQUEST', /studio or master location/)
            )
            await rejects(caller().generateShoppingList(undefined as never), trpcError('BAD_REQUEST'))
        })
    })
})
