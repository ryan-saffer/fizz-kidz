// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { InventoryPage } from './inventory-page'

vi.mock('../hooks/use-inventory-data', () => ({
    useInventoryData: () => ({ itemCount: 12, trackedStockCount: 8 }),
}))

vi.mock('../components/inventory/inventory-catalogue-card', () => ({
    InventoryCatalogueCard: () => <div>Inventory catalogue card</div>,
}))

vi.mock('../components/shopping-list/inventory-shopping-list-card', () => ({
    InventoryShoppingListCard: () => <div>Shopping list card</div>,
}))

vi.mock('../components/usage-rules/inventory-usage-rules-card', () => ({
    InventoryUsageRulesCard: () => <div>Usage rules card</div>,
}))

vi.mock('../components/shared/inventory-dialogs', () => ({
    InventoryDialogs: () => <div>Inventory dialogs</div>,
}))

describe('InventoryPage', () => {
    it('renders the header, catalogue, and dialogs without the parked shopping list and usage rules', () => {
        const { rerender } = render(<InventoryPage />)
        rerender(<InventoryPage />)

        expect(screen.getByText('Studio stock')).toBeTruthy()
        expect(screen.getByText('12')).toBeTruthy()
        expect(screen.getByText('8')).toBeTruthy()
        expect(screen.getByText('Inventory catalogue card')).toBeTruthy()
        expect(screen.getByText('Inventory dialogs')).toBeTruthy()
        expect(screen.queryByRole('tab')).toBeNull()
        expect(screen.queryByRole('button', { name: 'Shopping list' })).toBeNull()
        expect(screen.queryByText('Shopping list card')).toBeNull()
        expect(screen.queryByText('Usage rules card')).toBeNull()
    })
})
