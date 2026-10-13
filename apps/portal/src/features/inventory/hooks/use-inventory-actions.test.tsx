// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { useInventoryStore } from '../state/inventory-store'
import { useInventoryActions } from './use-inventory-actions'

import type {
    InventoryItemFormValues,
    StockActionFormValues,
    UsageRuleFormValues,
} from '../utils/inventory.form-schemas'
import type { ClientInventoryItem, ClientInventoryStockLevel, ClientInventoryUsageRule } from '../utils/inventory.types'

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    invalidateQueries: vi.fn(async () => undefined),
    mutationCalls: [] as { input: unknown; name: string }[],
    mutationOptionsByName: new Map<string, any>(),
    mutationResults: new Map<string, unknown>(),
    pendingMutations: new Set<string>(),
    queryClient: {} as { invalidateQueries: () => Promise<undefined> },
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}))
mocks.queryClient.invalidateQueries = mocks.invalidateQueries

vi.mock('@tanstack/react-query', () => ({
    useMutation: (options: any) => {
        mocks.mutationOptionsByName.set(options.name, options)
        const isPending = mocks.pendingMutations.has(options.name)
        const key = `${options.name}:${isPending}`
        // a stable result per mutation, like React Query, so memoised values are reused between renders
        if (!mocks.mutationResults.has(key)) {
            mocks.mutationResults.set(key, {
                isPending,
                mutateAsync: async (input: unknown) => {
                    mocks.mutationCalls.push({ input, name: options.name })
                    await mocks.mutationOptionsByName.get(options.name).onSuccess?.(undefined, input)
                },
            })
        }
        return mocks.mutationResults.get(key)
    },
    useQueryClient: () => mocks.queryClient,
}))

vi.mock('sonner', () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}))

vi.mock('@shared/components/dialogs/confirmation/use-confirmation-dialog', () => ({
    useConfirm: () => mocks.confirm,
}))

vi.mock('./use-inventory-location', () => ({
    useInventoryLocation: () => ({ location: 'balwyn' }),
}))

function mutation(name: string) {
    return {
        mutationOptions: (options: Record<string, unknown>) => ({ ...options, name }),
    }
}

function query(name: string) {
    return {
        queryKey: (input?: unknown) => [name, input],
    }
}

const trpc = {
    inventory: {
        countStock: mutation('countStock'),
        createItem: mutation('createItem'),
        createUsageRule: mutation('createUsageRule'),
        deleteItem: mutation('deleteItem'),
        deleteUsageRule: mutation('deleteUsageRule'),
        generateShoppingList: query('generateShoppingList'),
        listItems: query('listItems'),
        listMovements: query('listMovements'),
        listStock: query('listStock'),
        listUsageRules: query('listUsageRules'),
        receiveStock: mutation('receiveStock'),
        removeStock: mutation('removeStock'),
        setStocked: mutation('setStocked'),
        updateItem: mutation('updateItem'),
        updateStockLevel: mutation('updateStockLevel'),
        updateUsageRule: mutation('updateUsageRule'),
    },
}

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => trpc,
}))

const now = new Date('2026-05-01T00:00:00.000Z')

const item: ClientInventoryItem = {
    id: 'item-1',
    name: 'Party pies',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'quantity',
    baseUnit: 'each',
    runningLowThreshold: 10,
    createdAt: now,
    updatedAt: now,
}

const stock: ClientInventoryStockLevel = {
    id: 'stock-1',
    itemId: 'item-1',
    location: 'balwyn',
    stocked: true,
    measurement: { $type: 'quantity', quantity: 4 },
    updatedAt: now,
}

const usageRule: ClientInventoryUsageRule = {
    id: 'rule-1',
    inventoryKey: 'party-base:partyPies',
    $type: 'party-base',
    label: 'Party pies',
    status: 'active',
    quantity: { $operation: 'fixed', quantity: 2 },
    createdAt: now,
    updatedAt: now,
}

const quantityValues: InventoryItemFormValues = {
    $trackingMode: 'quantity',
    name: 'Party pies',
    category: 'party-food',
    baseUnit: 'each',
    runningLowThreshold: 10,
    squareCatalogObjectId: 'square-cake',
    usedPer: null,
    status: 'active',
    notes: '',
}

const qualitativeValues: InventoryItemFormValues = {
    $trackingMode: 'qualitative',
    name: 'Glitter',
    category: 'party-food',
    baseUnit: 'tub',
    runningLowThreshold: null,
    squareCatalogObjectId: null,
    usedPer: null,
    status: 'active',
    notes: 'Sparkle',
}

const usageRuleValues: UsageRuleFormValues = {
    $type: 'party-base',
    name: 'partyPies',
    label: 'Party pies',
    status: 'active',
    quantity: { $operation: 'fixed', quantity: 2 },
    notes: undefined,
}

async function callAction(action: () => Promise<void>) {
    await act(async () => {
        await action()
    })
}

describe('useInventoryActions', () => {
    beforeEach(() => {
        mocks.confirm.mockReset()
        mocks.invalidateQueries.mockClear()
        mocks.mutationCalls.length = 0
        mocks.mutationOptionsByName.clear()
        mocks.mutationResults.clear()
        mocks.pendingMutations.clear()
        mocks.toastError.mockClear()
        mocks.toastSuccess.mockClear()
        useInventoryStore.setState({
            editingItem: null,
            editingUsageRule: null,
            stockAction: null,
            isReceiveDeliveryOpen: false,
        })
    })

    it('creates and updates quantity and qualitative items', async () => {
        useInventoryStore.setState({ editingItem: item })
        const { rerender, result } = renderHook(() => useInventoryActions())

        await callAction(() => result.current.createItem(quantityValues))
        await callAction(() => result.current.createItem(qualitativeValues))
        await callAction(() => result.current.updateItem(quantityValues))
        useInventoryStore.setState({ editingItem: item })
        rerender()
        await callAction(() => result.current.updateItem(qualitativeValues))

        expect(mocks.mutationCalls).toEqual([
            {
                name: 'createItem',
                input: {
                    $trackingMode: 'quantity',
                    baseUnit: 'each',
                    category: 'party-food',
                    name: 'Party pies',
                    notes: undefined,
                    runningLowThreshold: 10,
                    squareCatalogObjectId: 'square-cake',
                    usedPer: undefined,
                    status: 'active',
                },
            },
            {
                name: 'createItem',
                input: {
                    $trackingMode: 'qualitative',
                    baseUnit: 'tub',
                    category: 'party-food',
                    name: 'Glitter',
                    notes: 'Sparkle',
                    status: 'active',
                },
            },
            {
                name: 'updateItem',
                input: {
                    item: {
                        $trackingMode: 'quantity',
                        baseUnit: 'each',
                        category: 'party-food',
                        name: 'Party pies',
                        notes: undefined,
                        runningLowThreshold: 10,
                        squareCatalogObjectId: 'square-cake',
                        usedPer: null,
                        status: 'active',
                    },
                    itemId: 'item-1',
                },
            },
            {
                name: 'updateItem',
                input: {
                    item: {
                        $trackingMode: 'qualitative',
                        baseUnit: 'tub',
                        category: 'party-food',
                        name: 'Glitter',
                        notes: 'Sparkle',
                        status: 'active',
                    },
                    itemId: 'item-1',
                },
            },
        ])
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Inventory item created.')
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Inventory item updated.')
    })

    it('skips item and usage-rule updates when nothing is selected', async () => {
        const { result } = renderHook(() => useInventoryActions())

        await callAction(() => result.current.updateItem(quantityValues))
        await callAction(() => result.current.updateUsageRule(usageRuleValues))
        await callAction(() => result.current.deleteItem())
        await callAction(() => result.current.deleteUsageRule())
        await callAction(() => result.current.submitStockAction({ quantity: 1, level: 'high', reason: '' }))

        expect(mocks.mutationCalls).toEqual([])
    })

    it('confirms destructive item and usage-rule deletes', async () => {
        mocks.confirm
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true)
        useInventoryStore.setState({ editingItem: item, editingUsageRule: usageRule })
        const { result } = renderHook(() => useInventoryActions())

        await callAction(() => result.current.deleteItem())
        expect(useInventoryStore.getState().editingItem?.id).toBe('item-1')

        await callAction(() => result.current.deleteItem())
        await callAction(() => result.current.deleteUsageRule())
        expect(useInventoryStore.getState().editingUsageRule?.id).toBe('rule-1')

        await callAction(() => result.current.deleteUsageRule())

        expect(mocks.confirm).toHaveBeenCalledWith({
            title: 'Delete Party pies everywhere?',
            description:
                'This will delete the item, all studio stock levels, and all stock movement history for this item.',
        })
        expect(mocks.confirm).toHaveBeenCalledWith({
            title: 'Delete usage rule Party pies?',
            description: 'This removes the rule from future shopping-list generation. It does not change stock counts.',
        })
        expect(mocks.mutationCalls).toEqual([
            { name: 'deleteItem', input: { itemId: 'item-1' } },
            { name: 'deleteUsageRule', input: { ruleId: 'rule-1' } },
        ])
    })

    it('creates, updates, and deletes usage rules', async () => {
        useInventoryStore.setState({ editingUsageRule: usageRule })
        const { result } = renderHook(() => useInventoryActions())

        await callAction(() => result.current.createUsageRule(usageRuleValues))
        await callAction(() => result.current.updateUsageRule(usageRuleValues))

        expect(mocks.mutationCalls).toEqual([
            { name: 'createUsageRule', input: usageRuleValues },
            { name: 'updateUsageRule', input: { ruleId: 'rule-1', rule: usageRuleValues } },
        ])
    })

    it('submits each stock action type to its own mutation', async () => {
        const { result, rerender } = renderHook(() => useInventoryActions())

        useInventoryStore.setState({ stockAction: { $type: 'level', item, stock } })
        rerender()
        await callAction(() => result.current.submitStockAction({ quantity: 0, level: 'low', reason: '' }))

        useInventoryStore.setState({ stockAction: { $type: 'receive', item, stock } })
        rerender()
        await callAction(() => result.current.submitStockAction({ quantity: 3, level: 'unknown', reason: 'Delivery' }))

        useInventoryStore.setState({ stockAction: { $type: 'count', item, stock } })
        rerender()
        const countValues: StockActionFormValues = { quantity: 7, level: 'unknown', reason: '' }
        await callAction(() => result.current.submitStockAction(countValues))

        useInventoryStore.setState({ stockAction: { $type: 'remove', item, stock } })
        rerender()
        await callAction(() => result.current.submitStockAction({ quantity: 2, level: 'unknown', reason: 'Dropped' }))

        expect(mocks.mutationCalls).toEqual([
            { name: 'updateStockLevel', input: { itemId: 'item-1', level: 'low', location: 'balwyn' } },
            {
                name: 'receiveStock',
                input: { lines: [{ itemId: 'item-1', quantity: 3 }], location: 'balwyn', note: 'Delivery' },
            },
            {
                name: 'countStock',
                input: { lines: [{ itemId: 'item-1', quantity: 7 }], location: 'balwyn', reason: undefined },
            },
            { name: 'removeStock', input: { itemId: 'item-1', location: 'balwyn', quantity: 2, reason: 'Dropped' } },
        ])
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Stock level updated.')
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Stock received.')
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Count saved.')
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Stock removed.')
        expect(useInventoryStore.getState().stockAction).toBeNull()
        expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['listStock', { location: 'balwyn' }] })
        expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['listMovements', undefined] })
    })

    it('receives deliveries, marks counts unknown, and toggles studio tracking', async () => {
        useInventoryStore.setState({ isReceiveDeliveryOpen: true })
        const { result } = renderHook(() => useInventoryActions())

        await callAction(() =>
            result.current.receiveDelivery({
                lines: [
                    { itemId: 'item-1', quantity: 4 },
                    { itemId: 'item-2', quantity: 10 },
                ],
                note: '',
            })
        )
        await callAction(() => result.current.markQuantityUnknown(item))
        await callAction(() => result.current.setItemStocked(item, false))
        await callAction(() => result.current.setItemStocked(item, true))

        expect(mocks.mutationCalls).toEqual([
            {
                name: 'receiveStock',
                input: {
                    lines: [
                        { itemId: 'item-1', quantity: 4 },
                        { itemId: 'item-2', quantity: 10 },
                    ],
                    location: 'balwyn',
                    note: undefined,
                },
            },
            {
                name: 'countStock',
                input: {
                    lines: [{ itemId: 'item-1', quantity: null }],
                    location: 'balwyn',
                    reason: 'Marked count unknown.',
                },
            },
            { name: 'setStocked', input: { itemId: 'item-1', location: 'balwyn', stocked: false } },
            { name: 'setStocked', input: { itemId: 'item-1', location: 'balwyn', stocked: true } },
        ])
        expect(useInventoryStore.getState().isReceiveDeliveryOpen).toBe(false)
    })

    it('shows mutation error toasts', () => {
        renderHook(() => useInventoryActions())

        mocks.mutationOptionsByName.get('createItem').onError()
        mocks.mutationOptionsByName.get('updateItem').onError()
        mocks.mutationOptionsByName.get('countStock').onError(new Error('Stock failed'))
        mocks.mutationOptionsByName.get('removeStock').onError({ message: '' })
        mocks.mutationOptionsByName.get('deleteItem').onError()
        mocks.mutationOptionsByName.get('setStocked').onError()
        mocks.mutationOptionsByName.get('createUsageRule').onError(new Error('Create failed'))
        mocks.mutationOptionsByName.get('createUsageRule').onError({ message: '' })
        mocks.mutationOptionsByName.get('updateUsageRule').onError(new Error('Update failed'))
        mocks.mutationOptionsByName.get('updateUsageRule').onError({ message: '' })
        mocks.mutationOptionsByName.get('deleteUsageRule').onError()

        expect(mocks.toastError).toHaveBeenCalledWith('Unable to create inventory item.')
        expect(mocks.toastError).toHaveBeenCalledWith('Unable to update inventory item.')
        expect(mocks.toastError).toHaveBeenCalledWith('Stock failed')
        expect(mocks.toastError).toHaveBeenCalledWith('Unable to update stock.')
        expect(mocks.toastError).toHaveBeenCalledWith('Unable to delete inventory item.')
        expect(mocks.toastError).toHaveBeenCalledWith('Unable to update studio tracking.')
        expect(mocks.toastError).toHaveBeenCalledWith('Create failed')
        expect(mocks.toastError).toHaveBeenCalledWith('Unable to create usage rule.')
        expect(mocks.toastError).toHaveBeenCalledWith('Update failed')
        expect(mocks.toastError).toHaveBeenCalledWith('Unable to update usage rule.')
        expect(mocks.toastError).toHaveBeenCalledWith('Unable to delete usage rule.')
    })

    it('runs mutation success callbacks directly', async () => {
        renderHook(() => useInventoryActions())

        await act(async () => {
            await mocks.mutationOptionsByName.get('createItem').onSuccess()
            await mocks.mutationOptionsByName.get('updateItem').onSuccess()
            await mocks.mutationOptionsByName.get('receiveStock').onSuccess()
            await mocks.mutationOptionsByName.get('updateStockLevel').onSuccess()
            await mocks.mutationOptionsByName.get('deleteItem').onSuccess()
            await mocks.mutationOptionsByName.get('setStocked').onSuccess(undefined, { stocked: true })
            await mocks.mutationOptionsByName.get('setStocked').onSuccess(undefined, { stocked: false })
            await mocks.mutationOptionsByName.get('createUsageRule').onSuccess()
            await mocks.mutationOptionsByName.get('updateUsageRule').onSuccess()
            await mocks.mutationOptionsByName.get('deleteUsageRule').onSuccess()
        })

        expect(mocks.toastSuccess).toHaveBeenCalledWith('Item is now tracked here.')
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Item marked unused here.')
    })

    it('reports pending flags for each mutation', () => {
        const flags = {
            countStock: 'isStockChangePending',
            createItem: 'isCreatingItem',
            createUsageRule: 'isCreatingUsageRule',
            deleteItem: 'isDeletingItem',
            deleteUsageRule: 'isDeletingUsageRule',
            receiveStock: 'isStockChangePending',
            removeStock: 'isStockChangePending',
            setStocked: 'isSetStockedPending',
            updateItem: 'isUpdatingItem',
            updateStockLevel: 'isStockChangePending',
            updateUsageRule: 'isUpdatingUsageRule',
        } as const

        const { rerender, result } = renderHook(() => useInventoryActions())
        const idle = result.current
        rerender()
        expect(result.current).toBe(idle)
        expect(Object.values(flags).some((flag) => idle[flag])).toBe(false)

        for (const [mutationName, flag] of Object.entries(flags)) {
            mocks.pendingMutations.clear()
            mocks.pendingMutations.add(mutationName)
            rerender()
            expect(result.current[flag]).toBe(true)
        }
    })

    it('reuses callbacks between renders until the editing selection changes', async () => {
        useInventoryStore.setState({ editingItem: item, editingUsageRule: usageRule })
        const { rerender, result } = renderHook(() => useInventoryActions())
        const first = result.current
        rerender()
        expect(result.current.updateItem).toBe(first.updateItem)
        expect(result.current.updateUsageRule).toBe(first.updateUsageRule)

        useInventoryStore.setState({ editingItem: { ...item, id: 'item-2' } })
        rerender()
        expect(result.current.updateItem).not.toBe(first.updateItem)
        await callAction(() => result.current.updateItem(qualitativeValues))
        expect(mocks.mutationCalls).toEqual([
            expect.objectContaining({ input: expect.objectContaining({ itemId: 'item-2' }) }),
        ])
    })

    it('throws on an unknown stock action type', async () => {
        useInventoryStore.setState({ stockAction: { $type: 'unknown' as never, item, stock } })
        const { result } = renderHook(() => useInventoryActions())

        await expect(result.current.submitStockAction({ quantity: 1, level: 'high', reason: '' })).rejects.toThrow(
            'Unhandled stock action'
        )
    })

    it('counts every item at once and closes the count dialog', async () => {
        useInventoryStore.setState({ isCountAllOpen: true })
        const { result } = renderHook(() => useInventoryActions())

        await callAction(() => result.current.countAll({ lines: [{ itemId: 'item-1', quantity: 5 }], reason: '' }))
        await callAction(() =>
            result.current.countAll({ lines: [{ itemId: 'item-1', quantity: 6 }], reason: 'Weekly count' })
        )

        expect(mocks.mutationCalls).toEqual([
            {
                name: 'countStock',
                input: { lines: [{ itemId: 'item-1', quantity: 5 }], location: 'balwyn', reason: undefined },
            },
            {
                name: 'countStock',
                input: { lines: [{ itemId: 'item-1', quantity: 6 }], location: 'balwyn', reason: 'Weekly count' },
            },
        ])
        expect(useInventoryStore.getState().isCountAllOpen).toBe(false)
    })

    it('names unlabelled usage rules by their inventory key when confirming a delete', async () => {
        mocks.confirm.mockResolvedValueOnce(true)
        useInventoryStore.setState({ editingUsageRule: { ...usageRule, label: '' } })
        const { result } = renderHook(() => useInventoryActions())

        await callAction(() => result.current.deleteUsageRule())

        expect(mocks.confirm).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Delete usage rule party-base:partyPies?' })
        )
    })

    it('keeps success handlers when only a mutation procedure changes', () => {
        const procedures = [
            'createItem',
            'updateItem',
            'deleteItem',
            'setStocked',
            'createUsageRule',
            'updateUsageRule',
            'deleteUsageRule',
        ] as const
        const { rerender } = renderHook(() => useInventoryActions())

        for (const name of procedures) {
            const original = trpc.inventory[name]
            const onSuccess = mocks.mutationOptionsByName.get(name).onSuccess
            trpc.inventory[name] = mutation(name)
            rerender()
            expect(mocks.mutationOptionsByName.get(name).onSuccess).toBe(onSuccess)
            trpc.inventory[name] = original
        }
    })
})
