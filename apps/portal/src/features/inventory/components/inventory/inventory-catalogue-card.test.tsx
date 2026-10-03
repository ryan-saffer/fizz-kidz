// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { useInventoryStore } from '../../state/inventory-store'
import { InventoryCatalogueCard } from './inventory-catalogue-card'

import type { ClientInventoryItem, ClientInventoryStockLevel } from '../../utils/inventory.types'
import type { ReactNode } from 'react'

vi.mock('@session/use-org', () => ({
    useOrg: () => ({
        hasPermission: (permission: string) =>
            (permission === 'inventory:manage-items' && canManageItems) ||
            (permission === 'inventory:update-stock' && canUpdateStock),
    }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: [], isPending: false }),
}))

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        inventory: { listSquareOptions: { queryOptions: () => ({}) } },
    }),
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

vi.mock('../../hooks/use-inventory-data', () => ({
    useInventoryData: () => ({
        activeTrackedCount: 1,
        availableLocations: ['balwyn', 'kingsville'],
        canChooseLocation,
        hiddenItems: catalogueHiddenItems,
        isLoading: false,
        itemCount: 2,
        location: catalogueLocation,
        needsCountItemCount: 0,
        notRunningLowItemCount: 0,
        runningLowItemCount: 1,
        shownItemCount: 2,
        stockByItemId: new Map([
            ['item-1', trackedStock],
            ['cake', cakeStock],
        ]),
        orderableItems: catalogueOrderableItems,
        supplyItems: [trackedItem],
        receivableItems: catalogueOrderableItems,
        trackedStockCount: 1,
    }),
}))

vi.mock('../../hooks/use-inventory-actions', () => ({
    useInventoryActions: () => ({
        createItem: vi.fn(),
        isCreatingItem: false,
        isStockChangePending: false,
        isSetStockedPending: false,
        markQuantityUnknown: vi.fn(),
        setItemStocked: vi.fn(),
    }),
}))

describe('InventoryCatalogueCard', () => {
    beforeEach(() => {
        canManageItems = true
        canUpdateStock = true
        canChooseLocation = true
        catalogueOrderableItems = []
        catalogueHiddenItems = [hiddenItem]
        catalogueLocation = 'balwyn'
        useInventoryStore.setState({
            categoryFilter: 'all',
            isCreateDialogOpen: false,
            isReceiveDeliveryOpen: false,
            search: '',
            selectedLocation: undefined,
            showHiddenItems: false,
            stockStatusFilter: 'all',
        })
    })

    afterEach(() => {
        cleanup()
    })

    it('renders catalogue controls and toggles hidden items', async () => {
        const user = userEvent.setup()

        const { rerender } = render(<InventoryCatalogueCard />)
        rerender(<InventoryCatalogueCard />)

        expect(screen.getByText('Inventory catalogue')).toBeTruthy()
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
        expect(headings.indexOf('Cakes & take-home bags')).toBeGreaterThan(-1)
        expect(headings.indexOf('Cakes & take-home bags')).toBeLessThan(headings.indexOf('Party food'))
        expect(screen.getByText('5 here')).toBeTruthy()
        expect(screen.getByText('2 reserved · 3 available to order')).toBeTruthy()
        expect(screen.getByText('4 units')).toBeTruthy()

        await user.click(screen.getByRole('button', { name: /Receive cake & bag delivery/ }))
        expect(useInventoryStore.getState().isReceiveDeliveryOpen).toBe(true)
    })

    it('hides the cakes section when nothing is orderable here', () => {
        render(<InventoryCatalogueCard />)

        expect(screen.queryByText('Cakes & take-home bags')).toBeNull()
        expect(screen.queryByRole('button', { name: /Receive cake & bag delivery/ })).toBeNull()
        expect(screen.getByText('Party food')).toBeTruthy()
    })

    it('lets staff update stock without managing items', () => {
        canManageItems = false
        catalogueOrderableItems = [cakeItem]

        render(<InventoryCatalogueCard />)

        expect(screen.queryByRole('button', { name: /Create new item/ })).toBeNull()
        expect(screen.getByRole('button', { name: /Receive cake & bag delivery/ })).toBeTruthy()
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
        expect(screen.queryByRole('button', { name: /Receive cake & bag delivery/ })).toBeNull()
        expect(screen.getByText('Viewing stock for selected studio.')).toBeTruthy()
        expect(screen.queryByRole('button', { name: /Show .* hidden/ })).toBeNull()
    })
})
