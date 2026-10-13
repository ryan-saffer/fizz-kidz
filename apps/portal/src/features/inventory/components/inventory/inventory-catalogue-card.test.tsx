// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { useInventoryStore } from '../../state/inventory-store'
import { InventoryCatalogueCard } from './inventory-catalogue-card'

import type { ClientInventoryItem, ClientInventoryStockLevel } from '../../utils/inventory.types'
import type { ReactNode } from 'react'

function hasPermission(permission: string) {
    return (
        (permission === 'inventory:manage-items' && canManageItems) ||
        (permission === 'inventory:update-stock' && canUpdateStock)
    )
}

vi.mock('@session/use-org', () => ({
    useOrg: () => ({ hasPermission }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: [], isPending: false }),
}))

const trpc = { inventory: { listSquareOptions: { queryOptions: () => ({}) } } }

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => trpc,
}))

vi.mock('@shared/lib/studio-utils', () => ({
    getOrgName: (studio: string) => `${studio} studio`,
}))

vi.mock('@shared/components/ui/dialog', () => {
    return {
        Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
        DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
        DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
        DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
        DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    }
})

vi.mock('@shared/components/ui/select', async () => {
    const { Children, isValidElement } = await import('react')

    function SelectItem({ value, children }: { value: string; children: ReactNode }) {
        return <option value={value}>{children}</option>
    }

    function collectOptions(children: ReactNode): ReactNode[] {
        return Children.toArray(children).flatMap((child) => {
            if (!isValidElement<{ children?: ReactNode }>(child)) return []
            if (child.type === SelectItem) return [child]
            return collectOptions(child.props.children)
        })
    }

    return {
        Select: ({ children, disabled, onValueChange, value }: any) => (
            <select disabled={disabled} value={value} onChange={(event) => onValueChange?.(event.target.value)}>
                {collectOptions(children)}
            </select>
        ),
        SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
        SelectGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
        SelectItem,
        SelectLabel: () => null,
        SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
        SelectValue: () => null,
    }
})

let canManageItems = true
let canUpdateStock = true
let catalogueOrderableItems: ClientInventoryItem[] = []
let canChooseLocation = true
let catalogueHiddenItems: ClientInventoryItem[] = []
let catalogueLocation: 'balwyn' | undefined = 'balwyn'
let catalogueIsLoading = false
let catalogueSupplyItems: ClientInventoryItem[] = []

/** Hook results stay the same object until an input changes, like the real hooks between renders. */
const stableResults = new Map<string, { inputs: unknown[]; value: unknown }>()
function stable<T>(name: string, inputs: unknown[], build: () => T): T {
    const cached = stableResults.get(name)
    if (cached && cached.inputs.every((input, index) => Object.is(input, inputs[index]))) {
        return cached.value as T
    }
    const value = build()
    stableResults.set(name, { inputs, value })
    return value
}

const now = new Date('2026-05-01T00:00:00.000Z')

const trackedItem: ClientInventoryItem = {
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
}

const hiddenItem: ClientInventoryItem = {
    ...trackedItem,
    id: 'item-2',
    name: 'Archived glitter',
    category: 'party-food',
    status: 'archived',
}

const trackedStock: ClientInventoryStockLevel = {
    id: 'stock-1',
    itemId: 'item-1',
    location: 'balwyn',
    stocked: true,
    measurement: { $type: 'quantity', quantity: 4 },
    updatedAt: now,
}

const cakeItem: ClientInventoryItem = {
    ...trackedItem,
    id: 'cake',
    name: 'Unicorn cake',
    inventoryKey: undefined,
    category: 'cakes',
    runningLowThreshold: null,
    squareCatalogObjectId: 'square-unicorn',
}

const cakeStock: ClientInventoryStockLevel = {
    ...trackedStock,
    id: 'stock-cake',
    itemId: 'cake',
    measurement: { $type: 'quantity', quantity: 5 },
    reservedQuantity: 2,
}

const stockByItemId = new Map([
    ['item-1', trackedStock],
    ['cake', cakeStock],
])

const actions = {
    createItem: vi.fn(),
    isCreatingItem: false,
    isStockChangePending: false,
    isSetStockedPending: false,
    markQuantityUnknown: vi.fn(),
    setItemStocked: vi.fn(),
}

vi.mock('../../hooks/use-inventory-data', () => ({
    useInventoryData: () =>
        stable(
            'data',
            [canChooseLocation, catalogueHiddenItems, catalogueIsLoading, catalogueLocation, catalogueOrderableItems],
            () => ({
                activeTrackedCount: 1,
                availableLocations: ['balwyn', 'kingsville'],
                canChooseLocation,
                hiddenItems: catalogueHiddenItems,
                isLoading: catalogueIsLoading,
                location: catalogueLocation,
                needsCountItemCount: 0,
                notRunningLowItemCount: 0,
                runningLowItemCount: 1,
                shownItemCount: 2,
                stockByItemId,
                orderableItems: catalogueOrderableItems,
                supplyItems: catalogueSupplyItems,
                receivableItems: catalogueOrderableItems,
            })
        ),
}))

vi.mock('../../hooks/use-inventory-actions', () => ({
    useInventoryActions: () => actions,
}))

describe('InventoryCatalogueCard', () => {
    beforeEach(() => {
        canManageItems = true
        canUpdateStock = true
        canChooseLocation = true
        catalogueOrderableItems = []
        catalogueHiddenItems = [hiddenItem]
        catalogueLocation = 'balwyn'
        catalogueIsLoading = false
        catalogueSupplyItems = [trackedItem]
        useInventoryStore.setState({
            categoryFilter: 'all',
            isCreateDialogOpen: false,
            isReceiveDeliveryOpen: false,
            search: '',
            selectedLocation: undefined,
            showHiddenItems: false,
            stockStatusFilter: 'all',
            isCountAllOpen: false,
        })
    })

    afterEach(() => {
        cleanup()
    })

    it('renders catalogue controls and toggles hidden items', async () => {
        const user = userEvent.setup()

        const { rerender } = render(<InventoryCatalogueCard />)
        rerender(<InventoryCatalogueCard />)

        expect(screen.getByRole('heading', { name: 'Inventory' })).toBeTruthy()
        expect(screen.getByText('2 shown')).toBeTruthy()
        expect(screen.getByRole('button', { name: /Create new item/ })).toBeTruthy()

        await user.type(screen.getByPlaceholderText('Search items'), 'pies')
        expect(useInventoryStore.getState().search).toBe('pies')
        await user.click(screen.getByRole('button', { name: 'Clear inventory search' }))
        expect(useInventoryStore.getState().search).toBe('')

        const comboboxes = screen.getAllByRole('combobox')
        // the first three belong to the (always rendered) create item form
        await user.selectOptions(comboboxes[3], 'cakes')
        await user.selectOptions(comboboxes[4], 'kingsville')
        expect(useInventoryStore.getState().categoryFilter).toBe('cakes')
        expect(useInventoryStore.getState().selectedLocation).toBe('kingsville')

        await user.click(screen.getByRole('button', { name: /Running low/ }))
        expect(useInventoryStore.getState().stockStatusFilter).toBe('running-low')

        await user.click(screen.getByRole('button', { name: /Show 1 hidden item/ }))
        expect(screen.getByText('Hidden items')).toBeTruthy()
        expect(screen.getByText('Archived glitter')).toBeTruthy()
    })

    it('shows cakes and take-home bags above supplies with a receive delivery button', async () => {
        const user = userEvent.setup()
        catalogueOrderableItems = [cakeItem]

        render(<InventoryCatalogueCard />)

        const headings = screen.getAllByRole('heading').map((heading) => heading.textContent)
        // one section per category, in catalogue order; no take-home bags are stocked here, so no section for them
        expect(headings.filter((heading) => ['Party Food', 'Cakes', 'Take Home Bags'].includes(heading ?? ''))).toEqual(
            ['Party Food', 'Cakes']
        )
        expect(screen.getByText('5 here')).toBeTruthy()
        expect(screen.getByText('2 reserved · 3 available to order')).toBeTruthy()
        expect(screen.getByText('4 units')).toBeTruthy()

        await user.click(screen.getByRole('button', { name: /Receive delivery/ }))
        expect(useInventoryStore.getState().isReceiveDeliveryOpen).toBe(true)
    })

    it('hides the cakes section when nothing is orderable here', () => {
        render(<InventoryCatalogueCard />)

        expect(screen.queryByRole('heading', { name: 'Cakes' })).toBeNull()
        expect(screen.queryByRole('button', { name: /Receive delivery/ })).toBeNull()
        expect(screen.getByRole('heading', { name: 'Party Food' })).toBeTruthy()
    })

    it('shows only the sections matching the category filter', () => {
        catalogueOrderableItems = [cakeItem]

        useInventoryStore.setState({ categoryFilter: 'cakes' })
        const { rerender } = render(<InventoryCatalogueCard />)
        expect(screen.getByRole('heading', { name: 'Cakes' })).toBeTruthy()
        expect(screen.queryByRole('heading', { name: 'Party Food' })).toBeNull()

        useInventoryStore.setState({ categoryFilter: 'party-food' })
        rerender(<InventoryCatalogueCard />)
        expect(screen.queryByRole('heading', { name: 'Cakes' })).toBeNull()
        expect(screen.getByRole('heading', { name: 'Party Food' })).toBeTruthy()
    })

    it('hides empty categories, saying so when nothing is left to show', () => {
        useInventoryStore.setState({ categoryFilter: 'take-home-bags' })
        render(<InventoryCatalogueCard />)

        expect(screen.queryByRole('heading', { name: 'Party Food' })).toBeNull()
        expect(screen.getByText('No take home bags found.')).toBeTruthy()
    })

    it('lets staff update stock without managing items', () => {
        canManageItems = false
        catalogueOrderableItems = [cakeItem]

        render(<InventoryCatalogueCard />)

        expect(screen.queryByRole('button', { name: /Create new item/ })).toBeNull()
        expect(screen.getByRole('button', { name: /Receive delivery/ })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Receive' })).toBeTruthy()
    })

    it('hides create and action controls without inventory permissions', () => {
        canManageItems = false
        canUpdateStock = false
        catalogueOrderableItems = [cakeItem]
        canChooseLocation = false
        catalogueHiddenItems = []
        catalogueLocation = undefined

        const { rerender } = render(<InventoryCatalogueCard />)
        rerender(<InventoryCatalogueCard />)

        expect(screen.queryByRole('button', { name: /Create new item/ })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Receive' })).toBeNull()
        expect(screen.queryByRole('button', { name: /Receive delivery/ })).toBeNull()
        expect(screen.getByText('Viewing stock for selected studio.')).toBeTruthy()
        expect(screen.queryByRole('button', { name: /Show .* hidden/ })).toBeNull()
    })

    it('opens a stock count and hides hidden items again', async () => {
        const user = userEvent.setup()
        catalogueOrderableItems = [cakeItem]
        render(<InventoryCatalogueCard />)

        await user.click(screen.getByRole('button', { name: /Count stock/ }))
        expect(useInventoryStore.getState().isCountAllOpen).toBe(true)

        await user.click(screen.getByRole('button', { name: /Show 1 hidden item/ }))
        await user.click(screen.getByRole('button', { name: /Hide 1 hidden item/ }))
        expect(screen.queryByText('Hidden items')).toBeNull()
        expect(screen.getByRole('button', { name: /Show 1 hidden item/ })).toBeTruthy()
    })

    it('says no items were found only once loading has finished', () => {
        catalogueSupplyItems = []
        catalogueHiddenItems = []
        catalogueIsLoading = true
        const { rerender } = render(<InventoryCatalogueCard />)
        expect(screen.queryByText('No items found.')).toBeNull()

        catalogueIsLoading = false
        rerender(<InventoryCatalogueCard />)
        expect(screen.getByText('No items found.')).toBeTruthy()
    })

    it('keeps the catalogue in place while the search and filters change', async () => {
        const user = userEvent.setup()
        catalogueOrderableItems = [cakeItem]
        render(<InventoryCatalogueCard />)

        await user.type(screen.getByPlaceholderText('Search items'), 'cake')
        await user.click(screen.getByRole('button', { name: /Running low/ }))
        await user.click(screen.getByRole('button', { name: /Show 1 hidden item/ }))
        act(() => useInventoryStore.setState({ isCreateDialogOpen: true }))

        expect(useInventoryStore.getState()).toMatchObject({ search: 'cake', stockStatusFilter: 'running-low' })
        expect(screen.getByRole('heading', { name: 'Cakes' })).toBeTruthy()
        expect(screen.getByRole('heading', { name: 'Party Food' })).toBeTruthy()
        expect(screen.getByText('Hidden items')).toBeTruthy()
        expect(screen.getByRole('button', { name: /Receive delivery/ })).toBeTruthy()
    })
})
