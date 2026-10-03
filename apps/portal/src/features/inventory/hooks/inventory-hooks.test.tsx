// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { useInventoryStore } from '../state/inventory-store'
import { useInventoryLocation } from './use-inventory-location'
import { useInventoryShoppingList } from './use-inventory-shopping-list'
import { useInventoryUsageRules } from './use-inventory-usage-rules'

const queryOptions = vi.fn((input: unknown, options?: unknown) => ({ input, options }))
const useQuery = vi.fn()
let currentOrg: 'master' | 'balwyn' | null = 'balwyn'
let canManageItems = true
let canShoppingList = true

vi.mock('@tanstack/react-query', () => ({
    useQuery: (options: unknown) => useQuery(options),
}))

vi.mock('@session/use-org', () => ({
    useOrg: () => ({
        currentOrg,
        hasPermission: (permission: string) => {
            if (permission === 'inventory:manage-items') return canManageItems
            if (permission === 'inventory:shopping-list') return canShoppingList
            return false
        },
    }),
}))

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        inventory: {
            listUsageRules: { queryOptions },
            generateShoppingList: { queryOptions },
        },
    }),
}))

describe('inventory hooks', () => {
    beforeEach(() => {
        currentOrg = 'balwyn'
        canManageItems = true
        canShoppingList = true
        queryOptions.mockClear()
        useQuery.mockReset()
        useQuery.mockReturnValue({ data: [], isPending: false })
        useInventoryStore.setState({
            selectedLocation: undefined,
            shoppingListStartDate: '2026-05-01',
            shoppingListEndDate: '2026-05-08',
        })
    })

    it('resolves selected inventory location', () => {
        let result = renderHook(() => useInventoryLocation()).result
        expect(result.current).toMatchObject({ canChooseLocation: false, location: 'balwyn' })

        currentOrg = 'master'
        useInventoryStore.getState().setSelectedLocation('kingsville')
        result = renderHook(() => useInventoryLocation()).result
        expect(result.current).toMatchObject({ canChooseLocation: true, location: 'kingsville' })

        useInventoryStore.getState().setSelectedLocation('not-a-studio' as any)
        result = renderHook(() => useInventoryLocation()).result
        expect(result.current.location).toBe(result.current.availableLocations[0])

        currentOrg = null
        result = renderHook(() => useInventoryLocation()).result
        expect(result.current.canChooseLocation).toBe(false)
        expect(result.current.availableLocations.length).toBeGreaterThan(1)
    })

    it('sorts usage rules and disables query without manage-items permission', () => {
        useQuery.mockReturnValue({
            data: [{ inventoryKey: 'z-key' }, { inventoryKey: 'a-key' }],
            isPending: false,
        })

        const result = renderHook(() => useInventoryUsageRules()).result

        expect(result.current.canEdit).toBe(true)
        expect(result.current.usageRules.map((rule) => rule.inventoryKey)).toEqual(['a-key', 'z-key'])
        expect(queryOptions).toHaveBeenCalledWith({ includeArchived: true }, { enabled: true })

        canManageItems = false
        renderHook(() => useInventoryUsageRules())
        expect(queryOptions).toHaveBeenLastCalledWith({ includeArchived: true }, { enabled: false })

        canManageItems = true
        useQuery.mockReturnValue({ data: undefined, isPending: true })
        const pendingResult = renderHook(() => useInventoryUsageRules()).result
        expect(pendingResult.current.isLoading).toBe(true)
        expect(pendingResult.current.usageRules).toEqual([])
    })

    it('builds shopping-list query options from date and location state', () => {
        currentOrg = 'master'
        useInventoryStore.getState().setSelectedLocation('balwyn')

        const result = renderHook(() => useInventoryShoppingList()).result

        expect(result.current.canGenerate).toBe(true)
        expect(result.current.location).toBe('master')
        expect(queryOptions).toHaveBeenCalledWith(
            {
                location: 'master',
                startDate: new Date('2026-05-01T00:00:00'),
                endDate: new Date('2026-05-08T23:59:59'),
            },
            { enabled: true }
        )

        canShoppingList = false
        renderHook(() => useInventoryShoppingList())
        expect(queryOptions).toHaveBeenLastCalledWith(expect.any(Object), { enabled: false })

        currentOrg = 'balwyn'
        canShoppingList = true
        useInventoryStore.setState({ shoppingListStartDate: '2026-05-08', shoppingListEndDate: '2026-05-01' })
        const invalidRangeResult = renderHook(() => useInventoryShoppingList()).result
        expect(invalidRangeResult.current.canGenerate).toBe(false)
        expect(invalidRangeResult.current.location).toBe('balwyn')
    })
})
