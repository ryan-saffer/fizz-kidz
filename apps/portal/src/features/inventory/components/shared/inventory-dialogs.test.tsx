// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { useInventoryStore } from '../../state/inventory-store'
import { InventoryDialogs } from './inventory-dialogs'

import type {
    ClientInventoryItem,
    ClientInventoryStockLevel,
    ClientInventoryUsageRule,
} from '../../utils/inventory.types'
import type { ReactNode } from 'react'

vi.mock('@shared/components/ui/dialog', () => {
    return {
        Dialog: ({ children, onOpenChange, open }: any) => (
            <div data-open={String(open)}>
                {children}
                <button type="button" onClick={() => onOpenChange?.(false)}>
                    Close dialog
                </button>
                <button type="button" onClick={() => onOpenChange?.(true)}>
                    Keep dialog open
                </button>
            </div>
        ),
        DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
        DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
        DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
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

vi.mock('@shared/lib/studio-utils', () => ({
    getOrgName: (studio: string) => `${studio} studio`,
}))

vi.mock('../../hooks/use-inventory-location', () => ({
    useInventoryLocation: () => ({ location: 'balwyn' }),
}))

const mocks = vi.hoisted(() => ({
    listMovementsQueryOptions: vi.fn((input: unknown) => ({ input, query: 'movements' })),
    movements: [] as unknown[],
    receivableItems: [] as unknown[],
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: (options: { query?: string }) =>
        options.query === 'movements' ? { data: mocks.movements, isPending: false } : { data: [], isPending: false },
}))

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        inventory: {
            listMovements: { queryOptions: mocks.listMovementsQueryOptions },
            listSquareOptions: { queryOptions: () => ({ query: 'square' }) },
        },
    }),
}))

vi.mock('../../hooks/use-inventory-data', () => ({
    useInventoryData: () => ({
        location: 'balwyn',
        receivableItems: mocks.receivableItems,
        stockByItemId: new Map([['cake', { ...stock, itemId: 'cake', reservedQuantity: 1 }]]),
    }),
}))

vi.mock('../../hooks/use-inventory-actions', () => ({
    useInventoryActions: () => ({
        deleteItem: vi.fn(),
        deleteUsageRule: vi.fn(),
        isStockChangePending: false,
        isDeletingItem: false,
        isDeletingUsageRule: false,
        isUpdatingItem: false,
        isUpdatingUsageRule: false,
        receiveDelivery: vi.fn(),
        submitStockAction: vi.fn(),
        updateItem: vi.fn(),
        updateUsageRule: vi.fn(),
    }),
}))

const now = new Date('2026-05-01T00:00:00.000Z')

const item: ClientInventoryItem = {
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
    $type: 'party-base',
    inventoryKey: 'party-base:partyPies',
    status: 'active',
    quantity: { $operation: 'fixed', quantity: 2 },
    createdAt: now,
    updatedAt: now,
}

describe('InventoryDialogs', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
        mocks.listMovementsQueryOptions.mockClear()
        mocks.movements = []
        mocks.receivableItems = []
        useInventoryStore.setState({
            editingItem: null,
            editingUsageRule: null,
            stockAction: null,
            isReceiveDeliveryOpen: false,
            isCountAllOpen: false,
            historyItem: null,
        })
    })

    afterEach(() => {
        cleanup()
    })

    it('renders edit and stock action dialogs from store state and closes them', async () => {
        const user = userEvent.setup()
        useInventoryStore.setState({
            editingItem: item,
            editingUsageRule: usageRule,
            stockAction: { $type: 'count', item, stock },
            isReceiveDeliveryOpen: true,
            isCountAllOpen: true,
            historyItem: item,
        })

        const { rerender } = render(<InventoryDialogs />)
        rerender(<InventoryDialogs />)

        expect(screen.getByText('Edit inventory item')).toBeTruthy()
        expect(screen.getByText('Edit usage rule')).toBeTruthy()
        expect(screen.getByText('Count Party pies')).toBeTruthy()
        expect(screen.getByText('Enter what is physically at balwyn studio right now.')).toBeTruthy()
        expect(screen.getByText('Receive a delivery at balwyn studio')).toBeTruthy()
        expect(screen.getByText('Count cakes & bags at balwyn studio')).toBeTruthy()
        expect(screen.getByText('Party pies history')).toBeTruthy()

        await user.click(screen.getAllByRole('button', { name: 'Keep dialog open' })[0])
        expect(useInventoryStore.getState().editingItem?.id).toBe('item-1')

        const closeButtons = screen.getAllByRole('button', { name: 'Close dialog' })
        await user.click(closeButtons[0])
        await user.click(closeButtons[1])
        await user.click(closeButtons[2])
        await user.click(closeButtons[3])
        await user.click(closeButtons[4])
        await user.click(closeButtons[5])

        expect(useInventoryStore.getState().editingItem).toBeNull()
        expect(useInventoryStore.getState().editingUsageRule).toBeNull()
        expect(useInventoryStore.getState().stockAction).toBeNull()
        expect(useInventoryStore.getState().isReceiveDeliveryOpen).toBe(false)
        expect(useInventoryStore.getState().isCountAllOpen).toBe(false)
        expect(useInventoryStore.getState().historyItem).toBeNull()
    })

    it('lists receivable items in the receive delivery dialog', () => {
        mocks.receivableItems = [{ ...item, id: 'cake', name: 'Unicorn cake', squareCatalogObjectId: 'sq-1' }]
        useInventoryStore.setState({ isReceiveDeliveryOpen: true })

        render(<InventoryDialogs />)

        expect(screen.getByLabelText('Unicorn cake received')).toBeTruthy()
        expect(screen.getByText('4 here now')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Receive delivery' })).toBeTruthy()
    })

    it('shows stock history for the selected item and location', () => {
        mocks.movements = [
            {
                id: 'm-1',
                itemId: 'item-1',
                location: 'balwyn',
                $type: 'counted',
                quantityBefore: 4,
                quantityAfter: 3,
                reason: 'One was squashed',
                createdAt: now,
                createdBy: { $type: 'staff', uid: 'uid-1', email: 'staff@fizzkidz.com.au' },
            },
            {
                id: 'm-2',
                itemId: 'item-1',
                location: 'balwyn',
                $type: 'reserved',
                bookingId: 'booking-1',
                quantity: 1,
                reservedBefore: 0,
                reservedAfter: 1,
                createdAt: now,
                createdBy: { $type: 'system' },
            },
        ]
        useInventoryStore.setState({ historyItem: item })

        render(<InventoryDialogs />)

        expect(mocks.listMovementsQueryOptions).toHaveBeenCalledWith({
            location: 'balwyn',
            itemId: 'item-1',
            limit: 100,
        })
        expect(screen.getByText('Counted 3')).toBeTruthy()
        expect(screen.getByText(/On hand 4 → 3 · staff@fizzkidz.com.au/)).toBeTruthy()
        expect(screen.getByText('“One was squashed”')).toBeTruthy()
        expect(screen.getByText('Reserved 1 for a party')).toBeTruthy()
        expect(screen.getByText(/Reserved 0 → 1 · Automatic/)).toBeTruthy()
    })

    it('renders empty stock dialog content safely when no action is selected', () => {
        const { rerender } = render(<InventoryDialogs />)
        rerender(<InventoryDialogs />)

        expect(screen.queryByText('Receive Party pies')).toBeNull()
    })
})
