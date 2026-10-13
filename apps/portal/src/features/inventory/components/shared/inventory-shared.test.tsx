// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { InventoryNotice } from './inventory-notice'
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

    it('styles notices by tone and keeps content when re-rendered', () => {
        const { container, rerender } = render(<InventoryNotice tone="info">Count everything</InventoryNotice>)
        expect(container.firstElementChild?.className).toContain('bg-sky-50')

        rerender(<InventoryNotice tone="info">Count everything</InventoryNotice>)
        rerender(<InventoryNotice tone="info">Count again</InventoryNotice>)
        expect(screen.getByText('Count again')).toBeTruthy()

        rerender(<InventoryNotice tone="warning">Count again</InventoryNotice>)
        expect(container.firstElementChild?.className).toContain('bg-amber-50')

        rerender(<InventoryNotice tone="danger">Count again</InventoryNotice>)
        expect(container.firstElementChild?.className).toContain('bg-red-50')
    })
})
