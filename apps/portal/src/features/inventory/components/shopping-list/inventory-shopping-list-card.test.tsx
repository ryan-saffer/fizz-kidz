// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { InventoryShoppingListCard } from './inventory-shopping-list-card'

import type { ReactNode } from 'react'

let shoppingListQuery = {
    data: undefined as any,
    isError: false,
    isFetching: false,
    isPending: false,
    error: { message: 'boom' },
    refetch: vi.fn(),
}
const initialQuery = { ...shoppingListQuery }
let canGenerate = true
let canViewShoppingList = true
let startDate = '2026-05-01'
let endDate = '2026-05-08'
let shoppingLocation: 'master' | 'balwyn' = 'master'
const setDateRange = vi.fn()

vi.mock('../../hooks/use-inventory-shopping-list', () => ({
    useInventoryShoppingList: () => ({
        canGenerate,
        canViewShoppingList,
        endDate,
        location: shoppingLocation,
        shoppingListQuery,
        startDate,
    }),
}))

vi.mock('../../state/inventory-store', () => ({
    useInventoryStore: (selector: any) => selector({ setShoppingListDateRange: setDateRange }),
}))

vi.mock('@shared/lib/studio-utils', () => ({
    getOrgName: (studio: string) => (studio === 'master' ? 'Corporate Studios' : `${studio} studio`),
}))

vi.mock('@shared/components/ui/calendar', () => ({
    Calendar: ({ onSelect }: any) => (
        <div data-testid="calendar">
            <button
                type="button"
                onClick={() => onSelect({ from: new Date('2026-05-02T00:00:00'), to: new Date('2026-05-03T00:00:00') })}
            >
                Select calendar range
            </button>
            <button type="button" onClick={() => onSelect(undefined)}>
                Clear calendar range
            </button>
        </div>
    ),
}))

vi.mock('@shared/components/ui/popover', () => {
    return {
        Popover: ({ children, onOpenChange }: { children: ReactNode; onOpenChange: (open: boolean) => void }) => (
            <div>
                {children}
                <button type="button" onClick={() => onOpenChange(true)}>
                    Open date picker
                </button>
            </div>
        ),
        PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    }
})

describe('InventoryShoppingListCard', () => {
    beforeEach(() => {
        shoppingListQuery = { ...initialQuery, refetch: shoppingListQuery.refetch }
        canGenerate = true
        canViewShoppingList = true
        shoppingListQuery.data = undefined
        shoppingListQuery.isError = false
        shoppingListQuery.isFetching = false
        shoppingListQuery.isPending = false
        shoppingListQuery.error = { message: 'boom' }
        shoppingListQuery.refetch.mockClear()
        setDateRange.mockClear()
        startDate = '2026-05-01'
        endDate = '2026-05-08'
        shoppingLocation = 'master'
    })

    afterEach(() => {
        cleanup()
    })

    it('does not render without shopping-list permission', () => {
        canViewShoppingList = false

        const { container, rerender } = render(<InventoryShoppingListCard />)
        rerender(<InventoryShoppingListCard />)

        expect(container.textContent).toBe('')
    })

    it('renders missing party form warning when child count is empty', () => {
        shoppingListQuery.data = {
            warnings: [
                {
                    $type: 'no-active-rules',
                    message: 'No active inventory usage rules are configured.',
                },
                {
                    $type: 'invalid-child-count',
                    bookingId: 'booking-1',
                    location: 'balwyn',
                    bookingLabel: 'Charlie',
                },
                {
                    $type: 'invalid-child-count',
                    bookingId: 'booking-2',
                    location: 'balwyn',
                    bookingLabel: 'Maya',
                    value: 'many',
                },
                {
                    $type: 'missing-inventory-item',
                    location: 'balwyn',
                    inventoryKey: 'party-base:partyPies',
                    requiredQuantity: 15,
                },
                {
                    $type: 'duplicate-inventory-items',
                    location: 'balwyn',
                    inventoryKey: 'party-base:partyPies',
                    itemIds: ['item-1', 'item-2'],
                    itemNames: ['Party pies', 'Party pies duplicate'],
                },
                {
                    $type: 'qualitative-item-required',
                    location: 'balwyn',
                    inventoryKey: 'party-base:glitter',
                    itemId: 'item-3',
                    itemName: 'Glitter',
                    requiredQuantity: 1,
                },
                {
                    $type: 'missing-stock-level',
                    location: 'balwyn',
                    inventoryKey: 'party-base:serviettes',
                    itemId: 'item-4',
                    itemName: 'Serviettes',
                    requiredQuantity: 10,
                },
                {
                    $type: 'unused-at-location',
                    location: 'balwyn',
                    inventoryKey: 'party-base:cups',
                    itemId: 'item-5',
                    itemName: 'Cups',
                    requiredQuantity: 10,
                },
                {
                    $type: 'unknown-stock-quantity',
                    location: 'balwyn',
                    inventoryKey: 'party-base:plates',
                    itemId: 'item-6',
                    itemName: 'Plates',
                    requiredQuantity: 10,
                },
            ],
            studioReports: [],
        }

        const { rerender } = render(<InventoryShoppingListCard />)
        rerender(<InventoryShoppingListCard />)

        expect(screen.getByText('No active inventory usage rules are configured.')).toBeTruthy()
        expect(screen.getByText('balwyn studio booking Charlie has not completed party form.')).toBeTruthy()
        expect(screen.getByText("balwyn studio booking Maya has invalid child count 'many'.")).toBeTruthy()
        expect(
            screen.getByText(
                "balwyn studio needs 15 for 'party-base:partyPies', but no active inventory item matches that key."
            )
        ).toBeTruthy()
        expect(
            screen.getByText(
                "balwyn studio has multiple active items for 'party-base:partyPies': Party pies, Party pies duplicate."
            )
        ).toBeTruthy()
        expect(
            screen.getByText(
                "balwyn studio needs 'Glitter', but it is qualitative. Check current level before ordering."
            )
        ).toBeTruthy()
        expect(
            screen.getByText("balwyn studio needs 'Serviettes', but no stock record exists for that studio.")
        ).toBeTruthy()
        expect(screen.getByText("balwyn studio needs 'Cups', but it is marked unused at that studio.")).toBeTruthy()
        expect(screen.getByText("balwyn studio needs 'Plates', but the current stock count is unknown.")).toBeTruthy()
    })

    it('renders line quantities and source breakdowns', () => {
        shoppingListQuery.data = {
            bookingCount: 1,
            warnings: [],
            studioReports: [
                {
                    location: 'balwyn',
                    bookingCount: 1,
                    warnings: [],
                    lines: [
                        {
                            itemId: 'item-1',
                            inventoryKey: 'party-base:partyPies',
                            itemName: 'Party pies',
                            category: 'party-food',
                            baseUnit: 'each',
                            location: 'balwyn',
                            requiredQuantity: 15,
                            quantityOnHand: 4,
                            suggestedPurchaseQuantity: 14,
                            stocked: false,
                            sourceBreakdown: [
                                {
                                    ruleId: 'rule-1',
                                    label: 'Party pies',
                                    requiredQuantity: 15,
                                    bookingCount: 1,
                                },
                                {
                                    ruleId: 'rule-2',
                                    label: 'Cups',
                                    requiredQuantity: 2,
                                    bookingCount: 2,
                                },
                            ],
                        },
                    ],
                },
            ],
        }

        const { rerender } = render(<InventoryShoppingListCard />)
        rerender(<InventoryShoppingListCard />)

        expect(screen.getByText('Party pies')).toBeTruthy()
        expect(screen.getByText('15 units')).toBeTruthy()
        expect(screen.getByText('4 units')).toBeTruthy()
        expect(screen.queryByText('Keep at least')).toBeNull()
        expect(screen.getByText('14 units')).toBeTruthy()
        expect(screen.getByText('Unused here')).toBeTruthy()
        expect(screen.getByText('Party pies: 15 across 1 booking')).toBeTruthy()
        expect(screen.getByText('Cups: 2 across 2 bookings')).toBeTruthy()
    })

    it('handles date picker changes, refetch, non-master locations, and empty studio reports', async () => {
        const user = userEvent.setup()
        shoppingLocation = 'balwyn'
        shoppingListQuery.data = {
            bookingCount: 2,
            warnings: [],
            studioReports: [{ location: 'balwyn', bookingCount: 1, warnings: [], lines: [] }],
        }

        render(<InventoryShoppingListCard />)

        expect(screen.getByText('Showing balwyn studio.')).toBeTruthy()
        expect(screen.getByText('No quantity-tracked items were calculated for this studio.')).toBeTruthy()

        await user.click(screen.getByRole('button', { name: 'Select calendar range' }))
        expect(setDateRange).toHaveBeenCalledWith({ startDate: '2026-05-02', endDate: '2026-05-03' })

        await user.click(screen.getByRole('button', { name: 'Clear calendar range' }))
        expect(setDateRange).toHaveBeenCalledWith({ startDate: '', endDate: '' })

        await user.click(screen.getByRole('button', { name: 'Generate' }))
        expect(shoppingListQuery.refetch).toHaveBeenCalledOnce()
    })

    it('renders query and date-range states', () => {
        canGenerate = false
        shoppingListQuery.isError = true
        shoppingListQuery.isFetching = true

        const { rerender } = render(<InventoryShoppingListCard />)
        rerender(<InventoryShoppingListCard />)

        expect(screen.getByText('Choose a valid date range')).toBeTruthy()
        expect(screen.getByText('Unable to generate shopping list')).toBeTruthy()
        expect(screen.getByText('boom')).toBeTruthy()
        expect((screen.getByRole('button', { name: /Generate/ }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('renders pending and empty date-range states', () => {
        startDate = ''
        endDate = ''
        shoppingListQuery.isPending = true

        const { rerender } = render(<InventoryShoppingListCard />)

        expect(screen.getByText('Pick date range')).toBeTruthy()
        expect(screen.getByText('Loading shopping list')).toBeTruthy()

        startDate = '2026-05-01'
        endDate = ''
        shoppingListQuery.isPending = false
        rerender(<InventoryShoppingListCard />)

        expect(screen.getByText('May 1st, 2026 - Pick end date')).toBeTruthy()
    })

    it('summarises studios with activity and how much of each line to buy', () => {
        shoppingListQuery.data = {
            bookingCount: 1,
            warnings: [],
            studioReports: [
                { location: 'kingsville', bookingCount: 0, warnings: [], lines: [] },
                {
                    location: 'balwyn',
                    bookingCount: 1,
                    warnings: [],
                    lines: [
                        line({
                            itemId: 'pies',
                            itemName: 'Party pies',
                            quantityOnHand: null,
                            suggestedPurchaseQuantity: null,
                        }),
                        line({ itemId: 'cups', itemName: 'Cups', quantityOnHand: 20, suggestedPurchaseQuantity: 0 }),
                    ],
                },
                {
                    location: 'malvern',
                    bookingCount: 0,
                    warnings: [{ $type: 'no-active-rules', message: 'No rules.' }],
                    lines: [],
                },
            ],
        }

        render(<InventoryShoppingListCard />)

        expect(screen.getAllByText('1 booking')).toHaveLength(1)
        expect(screen.queryByText('kingsville studio')).toBeNull()
        expect(screen.getByText('balwyn studio')).toBeTruthy()
        expect(screen.getByText('1 booking in this range')).toBeTruthy()
        expect(screen.getByText('malvern studio')).toBeTruthy()
        expect(screen.getByText('0 bookings in this range')).toBeTruthy()
        expect(screen.getByText('Unknown')).toBeTruthy()
        expect(screen.getByText('Count first')).toBeTruthy()
        expect(screen.getByText('Nothing')).toBeTruthy()
        expect(screen.queryByText('Unused here')).toBeNull()
        expect(screen.getAllByText('0 total units to buy')).toHaveLength(2)
    })

    it('says no stock is required when no studio had activity', () => {
        shoppingListQuery.data = {
            bookingCount: 0,
            warnings: [],
            studioReports: [{ location: 'balwyn', bookingCount: 0, warnings: [], lines: [] }],
        }

        render(<InventoryShoppingListCard />)

        expect(screen.getByText('0 bookings')).toBeTruthy()
        expect(screen.getByText('No stock required.')).toBeTruthy()
    })

    it('shows only the first 12 warnings', () => {
        shoppingListQuery.data = {
            bookingCount: 0,
            warnings: Array.from({ length: 14 }, (_, index) => ({
                $type: 'no-active-rules',
                message: `Warning ${index + 1}`,
            })),
            studioReports: [],
        }

        render(<InventoryShoppingListCard />)

        expect(screen.getByText('Warning 12')).toBeTruthy()
        expect(screen.queryByText('Warning 13')).toBeNull()
        expect(screen.getByText('Showing 12 of 14 warnings.')).toBeTruthy()
    })

    it('throws on an unknown warning type', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        shoppingListQuery.data = { bookingCount: 0, warnings: [{ $type: 'mystery' }], studioReports: [] }

        expect(() => render(<InventoryShoppingListCard />)).toThrow('Unhandled warning.$type')
        vi.mocked(console.error).mockRestore()
    })

    it('keeps the report on screen while it refetches and the date picker opens', async () => {
        const user = userEvent.setup()
        const report = {
            bookingCount: 2,
            warnings: [{ $type: 'no-active-rules', message: 'No rules.' }],
            studioReports: [
                {
                    location: 'balwyn',
                    bookingCount: 2,
                    warnings: [],
                    lines: [line({ itemId: 'pies', itemName: 'Party pies' })],
                },
                { location: 'kingsville', bookingCount: 1, warnings: [], lines: [] },
            ],
        }
        shoppingListQuery.data = report
        const { rerender } = render(<InventoryShoppingListCard />)

        // React Query hands back a new result object whenever its status changes
        shoppingListQuery = { ...shoppingListQuery, isFetching: true }
        rerender(<InventoryShoppingListCard />)
        expect((screen.getByRole('button', { name: /Generate/ }) as HTMLButtonElement).disabled).toBe(true)

        shoppingListQuery = { ...shoppingListQuery, isFetching: false }
        canGenerate = false
        rerender(<InventoryShoppingListCard />)
        expect(screen.getByText('Choose a valid date range')).toBeTruthy()

        shoppingLocation = 'balwyn'
        rerender(<InventoryShoppingListCard />)
        expect(screen.getByText('Showing balwyn studio.')).toBeTruthy()

        await user.click(screen.getByRole('button', { name: 'Open date picker' }))
        expect(screen.getByText('May 1st, 2026 - May 8th, 2026')).toBeTruthy()
        expect(screen.getByText('No rules.')).toBeTruthy()
        expect(screen.getByText('14 units')).toBeTruthy()
        expect(screen.getByText('No quantity-tracked items were calculated for this studio.')).toBeTruthy()
    })
})

function line(overrides: Record<string, unknown>) {
    return {
        itemId: 'item-1',
        inventoryKey: 'party-base:partyPies',
        itemName: 'Party pies',
        category: 'party-food',
        baseUnit: 'each',
        location: 'balwyn',
        requiredQuantity: 15,
        quantityOnHand: 4,
        suggestedPurchaseQuantity: 14,
        stocked: true,
        sourceBreakdown: [],
        ...overrides,
    }
}
