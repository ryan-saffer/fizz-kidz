// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { CountAllForm } from './count-all-form'
import { InventoryItemForm } from './inventory-item-form'
import { ReceiveDeliveryForm } from './receive-delivery-form'
import { StockActionForm } from './stock-action-form'

import type { InventoryItemFormInput } from '../../utils/inventory.form-schemas'
import type { ClientInventoryItem, ClientInventoryStockLevel, StockAction } from '../../utils/inventory.types'

vi.mock('@shared/components/ui/select', async () => {
    const React = await import('react')

    function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
        return <option value={value}>{children}</option>
    }

    function collectOptions(children: React.ReactNode): React.ReactNode[] {
        return React.Children.toArray(children).flatMap((child) => {
            if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return []
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
        SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        SelectGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        SelectItem,
        SelectLabel: () => null,
        SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        SelectValue: () => null,
    }
})

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({
        data: [
            { id: 'square-unicorn', name: 'Unicorn', group: 'Cake designs' },
            { id: 'square-bag', name: 'Lolly bag', group: 'Take-home bags' },
        ],
        isPending: false,
    }),
}))

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        inventory: { listSquareOptions: { queryOptions: () => ({}) } },
    }),
}))

const now = new Date('2026-05-01T00:00:00.000Z')

const quantityItem: ClientInventoryItem = {
    id: 'item-1',
    name: 'Party pies',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'quantity',
    baseUnit: 'each',
    runningLowThreshold: 10,
    notes: 'Frozen',
    createdAt: now,
    updatedAt: now,
}

const qualitativeItem: ClientInventoryItem = {
    id: 'item-2',
    name: 'Glitter',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'qualitative',
    baseUnit: 'tub',
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

const unknownQuantityStock: ClientInventoryStockLevel = {
    ...quantityStock,
    measurement: { $type: 'quantity', quantity: null },
}

const qualitativeStock: ClientInventoryStockLevel = {
    id: 'stock-2',
    itemId: 'item-2',
    location: 'balwyn',
    stocked: true,
    measurement: { $type: 'qualitative', level: 'medium' },
    updatedAt: now,
}

afterEach(() => {
    cleanup()
})

describe('InventoryItemForm', () => {
    it('normalizes submitted quantity and qualitative item values', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()

        const { rerender } = render(
            <InventoryItemForm isPending={false} submitLabel="Create item" onSubmit={onSubmit} />
        )
        rerender(<InventoryItemForm isPending={false} submitLabel="Create item" onSubmit={onSubmit} />)

        await user.type(screen.getByLabelText('Item name'), 'Party pies')
        expect(screen.queryByLabelText('Shopping-list name')).toBeNull()
        await user.type(screen.getByLabelText('Counted in'), 'box')
        await user.type(screen.getByLabelText('Running low threshold'), '5')
        expect(screen.queryByLabelText('Keep at least')).toBeNull()

        // party food isn't ordered by customers, so there's no Square link until it's a cake
        expect(screen.queryByLabelText('Ordered by customers as')).toBeNull()
        await user.selectOptions(screen.getAllByRole('combobox')[0], 'cakes')
        const [category, tracking, squareLink, status] = screen.getAllByRole('combobox')
        expect(within(squareLink).queryByText('Lolly bag')).toBeNull()
        await user.selectOptions(status, 'archived')

        await user.click(screen.getByRole('button', { name: 'Create item' }))
        expect(await screen.findByText(/Choose what customers order this as/)).toBeTruthy()
        expect(onSubmit).not.toHaveBeenCalled()

        await user.selectOptions(squareLink, 'square-unicorn')
        await user.click(screen.getByRole('button', { name: 'Create item' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenLastCalledWith({
                $trackingMode: 'quantity',
                name: 'Party pies',
                category: 'cakes',
                baseUnit: 'box',
                runningLowThreshold: 5,
                squareCatalogObjectId: 'square-unicorn',
                status: 'archived',
                notes: '',
            })
        })

        await user.selectOptions(category, 'party-food')
        expect(screen.queryByLabelText('Ordered by customers as')).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Create item' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ squareCatalogObjectId: null }))
        })

        await user.selectOptions(tracking, 'qualitative')
        expect(screen.queryByLabelText('Running low threshold')).toBeNull()
        expect(screen.queryByLabelText('Ordered by customers as')).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Create item' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    $trackingMode: 'qualitative',
                    runningLowThreshold: null,
                    squareCatalogObjectId: null,
                })
            )
        })
    })

    it('resets from default values and supports delete and pending states', async () => {
        const onDelete = vi.fn()
        const user = userEvent.setup()
        const defaultValues: InventoryItemFormInput = {
            name: 'Glitter',
            category: 'party-food',
            $trackingMode: 'qualitative',
            baseUnit: 'tub',
            runningLowThreshold: '',
            squareCatalogObjectId: '',
            status: 'active',
            notes: 'Use sparingly',
        }

        const { rerender } = render(
            <InventoryItemForm
                defaultValues={defaultValues}
                isPending={false}
                item={qualitativeItem}
                submitLabel="Save changes"
                onDelete={onDelete}
                onSubmit={vi.fn()}
            />
        )

        expect((screen.getByLabelText('Item name') as HTMLInputElement).value).toBe('Glitter')
        expect(screen.getByDisplayValue('Use sparingly')).toBeTruthy()

        await user.click(screen.getByRole('button', { name: /Delete item/ }))
        expect(onDelete).toHaveBeenCalledOnce()

        rerender(
            <InventoryItemForm
                defaultValues={defaultValues}
                isPending
                item={qualitativeItem}
                submitLabel="Save changes"
                onDelete={onDelete}
                onSubmit={vi.fn()}
            />
        )
        expect((screen.getByRole('button', { name: /Save changes/ }) as HTMLButtonElement).disabled).toBe(true)
    })
})

describe('StockActionForm', () => {
    const orderableItem: ClientInventoryItem = { ...quantityItem, name: 'Unicorn cake', squareCatalogObjectId: 'sq-1' }
    const orderableStock: ClientInventoryStockLevel = { ...quantityStock, reservedQuantity: 2 }

    it('submits received stock quantities', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()
        const action: StockAction = { $type: 'receive', item: quantityItem, stock: quantityStock }

        const { rerender } = render(<StockActionForm action={action} isPending={false} onSubmit={onSubmit} />)
        rerender(<StockActionForm action={action} isPending={false} onSubmit={onSubmit} />)

        expect((screen.getByLabelText('Quantity received') as HTMLInputElement).value).toBe('')
        await user.type(screen.getByLabelText('Quantity received'), '3')
        await user.type(screen.getByLabelText('Notes (optional)'), 'Delivery')
        await user.click(screen.getByRole('button', { name: 'Receive stock' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({ quantity: 3, level: 'unknown', reason: 'Delivery' })
        })
    })

    it('starts counts empty and shows the recorded count for supplies', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()
        const unknownAction: StockAction = { $type: 'count', item: quantityItem, stock: unknownQuantityStock }
        const knownAction: StockAction = { $type: 'count', item: quantityItem, stock: quantityStock }

        const { rerender } = render(<StockActionForm action={unknownAction} isPending={false} onSubmit={onSubmit} />)

        expect(screen.getByText('The recorded count is unknown.')).toBeTruthy()
        expect((screen.getByLabelText('Counted quantity') as HTMLInputElement).value).toBe('')
        await user.type(screen.getByLabelText('Counted quantity'), '7')
        await user.click(screen.getByRole('button', { name: 'Save count' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({ quantity: 7, level: 'unknown', reason: '' })
        })

        rerender(<StockActionForm action={knownAction} isPending onSubmit={onSubmit} />)
        expect(screen.getByText('The recorded count is 4.')).toBeTruthy()
        expect((screen.getByRole('button', { name: /Save count/ }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('requires a reason when an orderable count does not match and warns when parties will be short', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()
        const action: StockAction = { $type: 'count', item: orderableItem, stock: orderableStock }

        render(<StockActionForm action={action} isPending={false} onSubmit={onSubmit} />)

        expect(screen.getByText(/The\s+system has 4 on hand \(2 reserved\)/)).toBeTruthy()
        expect(screen.queryByText(/The recorded count is/)).toBeNull()
        expect(screen.getByLabelText('Notes (optional)')).toBeTruthy()

        await user.type(screen.getByLabelText('Counted quantity'), '1')
        expect(screen.getByLabelText('Reason')).toBeTruthy()
        expect(screen.getByText(/That leaves 1 on hand but 2 are reserved/)).toBeTruthy()

        await user.click(screen.getByRole('button', { name: 'Save count' }))
        expect(await screen.findByText(/doesn't match the 4 on record/)).toBeTruthy()
        expect(onSubmit).not.toHaveBeenCalled()

        await user.type(screen.getByLabelText('Reason'), 'Three were squashed')
        await user.click(screen.getByRole('button', { name: 'Save count' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({ quantity: 1, level: 'unknown', reason: 'Three were squashed' })
        })
    })

    it('requires a reason to remove stock and caps it at what is on hand', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()
        const action: StockAction = { $type: 'remove', item: orderableItem, stock: orderableStock }

        render(<StockActionForm action={action} isPending={false} onSubmit={onSubmit} />)

        await user.type(screen.getByLabelText('Quantity to remove'), '5')
        await user.click(screen.getByRole('button', { name: 'Remove stock' }))

        expect(await screen.findByText('Only 4 on hand.')).toBeTruthy()
        expect(screen.getByText('Say why it was removed.')).toBeTruthy()
        expect(onSubmit).not.toHaveBeenCalled()

        await user.clear(screen.getByLabelText('Quantity to remove'))
        await user.type(screen.getByLabelText('Quantity to remove'), '3')
        expect(screen.getByText(/That leaves 1 on hand but 2 are reserved/)).toBeTruthy()
        await user.type(screen.getByLabelText('Reason'), 'Dropped')
        await user.click(screen.getByRole('button', { name: 'Remove stock' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({ quantity: 3, level: 'unknown', reason: 'Dropped' })
        })
    })

    it('submits qualitative stock levels', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()
        const action: StockAction = { $type: 'level', item: qualitativeItem, stock: qualitativeStock }

        const { rerender } = render(<StockActionForm action={action} isPending={false} onSubmit={onSubmit} />)
        rerender(<StockActionForm action={action} isPending={false} onSubmit={onSubmit} />)

        await user.selectOptions(screen.getByRole('combobox'), 'high')
        await user.click(screen.getByRole('button', { name: 'Update level' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({ quantity: 0, level: 'high', reason: '' })
        })
    })
})

describe('ReceiveDeliveryForm', () => {
    const cake: ClientInventoryItem = {
        ...quantityItem,
        id: 'cake',
        name: 'Unicorn cake',
        squareCatalogObjectId: 'sq-1',
    }
    const bags: ClientInventoryItem = { ...quantityItem, id: 'bags', name: 'Lolly bags', squareCatalogObjectId: 'sq-2' }
    const stockByItemId = new Map([['cake', { ...quantityStock, itemId: 'cake', reservedQuantity: 2 }]])

    beforeEach(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
    })

    it('shows an empty state when nothing orderable is tracked here', () => {
        render(<ReceiveDeliveryForm items={[]} stockByItemId={new Map()} isPending={false} onSubmit={vi.fn()} />)

        expect(screen.getByText('No cakes or take-home bags are tracked at this studio yet.')).toBeTruthy()
    })

    it('requires a checked delivery and submits only the lines that arrived', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()

        render(
            <ReceiveDeliveryForm
                items={[cake, bags]}
                stockByItemId={stockByItemId}
                isPending={false}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByText('4 here now')).toBeTruthy()
        expect(screen.getByText('0 here now')).toBeTruthy()

        await user.click(screen.getByRole('button', { name: 'Receive delivery' }))
        expect(await screen.findByText('Enter at least one quantity.')).toBeTruthy()
        expect(screen.getByText('Physically check the delivery before receiving it.')).toBeTruthy()

        await user.type(screen.getByLabelText('Unicorn cake received'), '6')
        await user.type(screen.getByLabelText('Notes (optional)'), 'October drop')
        await user.click(screen.getByRole('checkbox'))
        await user.click(screen.getByRole('button', { name: 'Receive delivery' }))

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({ lines: [{ itemId: 'cake', quantity: 6 }], note: 'October drop' })
        })
    })
})

describe('CountAllForm', () => {
    const cake: ClientInventoryItem = {
        ...quantityItem,
        id: 'cake',
        name: 'Unicorn cake',
        squareCatalogObjectId: 'sq-1',
    }
    const dino: ClientInventoryItem = {
        ...quantityItem,
        id: 'dino',
        name: 'Dinosaur cake',
        squareCatalogObjectId: 'sq-2',
    }
    const stockByItemId = new Map([
        ['cake', { ...quantityStock, itemId: 'cake', reservedQuantity: 2 }],
        ['dino', { ...quantityStock, itemId: 'dino', reservedQuantity: 0 }],
    ])

    it('saves a matching count of several cakes without a reason, skipping blank rows', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()
        render(
            <CountAllForm items={[cake, dino]} stockByItemId={stockByItemId} isPending={false} onSubmit={onSubmit} />
        )

        expect(screen.getAllByText('System has 4 (2 reserved)')).toHaveLength(1)
        await user.type(screen.getByLabelText('Unicorn cake counted'), '4')
        await user.click(screen.getByRole('button', { name: 'Save count' }))

        await waitFor(() =>
            expect(onSubmit).toHaveBeenCalledWith({ lines: [{ itemId: 'cake', quantity: 4 }], reason: '' })
        )
    })

    it('needs one reason when any count differs, and warns when a party will be short', async () => {
        const onSubmit = vi.fn()
        const user = userEvent.setup()
        render(
            <CountAllForm items={[cake, dino]} stockByItemId={stockByItemId} isPending={false} onSubmit={onSubmit} />
        )

        await user.type(screen.getByLabelText('Unicorn cake counted'), '1')
        await user.type(screen.getByLabelText('Dinosaur cake counted'), '4')
        expect(screen.getByText(/Unicorn cake: fewer counted than are reserved/)).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Save count' }))
        expect(await screen.findByText(/Some counts don't match the record/)).toBeTruthy()
        expect(onSubmit).not.toHaveBeenCalled()

        await user.type(screen.getByLabelText('Reason'), 'Melted')
        await user.click(screen.getByRole('button', { name: 'Save count' }))
        await waitFor(() =>
            expect(onSubmit).toHaveBeenCalledWith({
                lines: [
                    { itemId: 'cake', quantity: 1 },
                    { itemId: 'dino', quantity: 4 },
                ],
                reason: 'Melted',
            })
        )
    })
})
