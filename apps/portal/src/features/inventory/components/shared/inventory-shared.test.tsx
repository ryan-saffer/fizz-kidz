// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { InventoryPageHeader } from './inventory-page-header'
import { InventorySectionHeading } from './inventory-section-heading'

afterEach(() => {
    cleanup()
})

describe('inventory shared components', () => {
    it('renders section headings', () => {
        const { rerender } = render(
            <InventorySectionHeading title="Tracked items" description="Current stock levels" />
        )
        rerender(<InventorySectionHeading title="Tracked items" description="Current stock levels" />)

        expect(screen.getByText('Tracked items')).toBeTruthy()
        expect(screen.getByText('Current stock levels')).toBeTruthy()
    })

    it('renders page header stats', () => {
        const { rerender } = render(<InventoryPageHeader itemCount={12} trackedCount={8} />)
        rerender(<InventoryPageHeader itemCount={12} trackedCount={8} />)
        rerender(<InventoryPageHeader itemCount={13} trackedCount={9} />)

        expect(screen.getByText('Studio stock')).toBeTruthy()
        expect(screen.getByText('Items')).toBeTruthy()
        expect(screen.getByText('Tracked here')).toBeTruthy()
        expect(screen.getByText('13')).toBeTruthy()
        expect(screen.getByText('9')).toBeTruthy()
    })
})
