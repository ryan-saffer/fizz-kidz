// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { useInventoryStore } from '../../state/inventory-store'
import { InventoryUsageRulesCard } from './inventory-usage-rules-card'

import type { ClientInventoryUsageRule } from '../../utils/inventory.types'
import type { ReactNode } from 'react'

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

vi.mock('./usage-rule-form', () => ({
    UsageRuleForm: ({ isPending, submitLabel }: { isPending: boolean; submitLabel: string }) => (
        <div>
            {submitLabel} form{isPending ? ' (saving)' : ''}
        </div>
    ),
}))

const usageRulesState: { canEdit: boolean; isLoading: boolean; usageRules: ClientInventoryUsageRule[] } = {
    canEdit: true,
    isLoading: false,
    usageRules: [],
}

vi.mock('../../hooks/use-inventory-usage-rules', () => ({
    useInventoryUsageRules: () => usageRulesState,
}))

const createUsageRule = vi.fn()
let actions = { isCreatingUsageRule: false, createUsageRule }

vi.mock('../../hooks/use-inventory-actions', () => ({
    useInventoryActions: () => actions,
}))

const now = new Date('2026-05-01T00:00:00.000Z')

const rules: ClientInventoryUsageRule[] = [
    {
        id: 'rule-1',
        $type: 'party-addition',
        addition: 'chickenNuggets',
        inventoryKey: 'party-addition:chickenNuggets',
        status: 'active',
        quantity: { $operation: 'fixed', quantity: 2 },
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'rule-2',
        $type: 'party-base',
        inventoryKey: 'party-base:partyPies',
        label: 'Party pies',
        status: 'archived',
        quantity: { $operation: 'per-child', quantityPerChild: 1 },
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'rule-3',
        $type: 'party-food-package',
        inventoryKey: 'party-food-package:fairyBread',
        status: 'active',
        quantity: { $operation: 'fixed-plus-per-child', fixedQuantity: 1, quantityPerChild: 0.5 },
        createdAt: now,
        updatedAt: now,
    },
]

describe('InventoryUsageRulesCard', () => {
    beforeEach(() => {
        usageRulesState.canEdit = true
        usageRulesState.isLoading = false
        usageRulesState.usageRules = []
        actions = { isCreatingUsageRule: false, createUsageRule }
        useInventoryStore.setState({ editingUsageRule: null, isCreateUsageRuleDialogOpen: false })
    })

    afterEach(() => {
        cleanup()
    })

    it('does not render without write permission', () => {
        usageRulesState.canEdit = false

        const { container, rerender } = render(<InventoryUsageRulesCard />)
        rerender(<InventoryUsageRulesCard />)

        expect(container.textContent).toBe('')
    })

    it('renders loading and empty states', () => {
        usageRulesState.isLoading = true
        const { rerender } = render(<InventoryUsageRulesCard />)
        rerender(<InventoryUsageRulesCard />)

        expect(screen.getByText('Loading usage rules')).toBeTruthy()

        usageRulesState.isLoading = false
        rerender(<InventoryUsageRulesCard />)

        expect(screen.getByText('No usage rules yet.')).toBeTruthy()
        expect(screen.getByText('Create rule form')).toBeTruthy()
    })

    it('renders usage rules and opens edit state', async () => {
        const user = userEvent.setup()
        usageRulesState.usageRules = rules

        const { rerender } = render(<InventoryUsageRulesCard />)
        rerender(<InventoryUsageRulesCard />)

        expect(screen.getByText('Chicken Nuggets')).toBeTruthy()
        expect(screen.getByText('Party pies')).toBeTruthy()
        expect(screen.getByText('fairyBread')).toBeTruthy()
        expect(screen.getByText('2 per booking')).toBeTruthy()
        expect(screen.getByText('1 per child')).toBeTruthy()
        expect(screen.getByText('1 per booking + 0.5 per child')).toBeTruthy()

        await user.click(screen.getAllByRole('button', { name: 'Edit' })[0])

        expect(useInventoryStore.getState().editingUsageRule?.id).toBe('rule-1')
    })

    it('shows the create form saving without redrawing the rules', () => {
        usageRulesState.usageRules = rules
        const { rerender } = render(<InventoryUsageRulesCard />)

        actions = { ...actions, isCreatingUsageRule: true }
        rerender(<InventoryUsageRulesCard />)
        expect(screen.getByText('Create rule form (saving)')).toBeTruthy()

        actions = { ...actions, isCreatingUsageRule: false }
        usageRulesState.isLoading = true
        rerender(<InventoryUsageRulesCard />)
        expect(screen.getByText('Create rule form')).toBeTruthy()
        expect(screen.getByText('Loading usage rules')).toBeTruthy()
        expect(screen.queryByText('Party pies')).toBeNull()
    })

    it('throws on an unknown quantity operation', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        usageRulesState.usageRules = [{ ...rules[0], quantity: { $operation: 'mystery' } as never }]

        expect(() => render(<InventoryUsageRulesCard />)).toThrow('Unhandled quantity.$operation')
        vi.mocked(console.error).mockRestore()
    })
})
