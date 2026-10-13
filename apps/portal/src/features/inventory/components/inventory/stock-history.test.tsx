// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { StockHistory } from './stock-history'

import type { ClientInventoryItem } from '../../utils/inventory.types'

const mocks = vi.hoisted(() => ({
    query: { data: undefined as unknown, isPending: false },
    queryOptions: vi.fn((input: unknown) => ({ input })),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => mocks.query,
}))

const trpc = { inventory: { listMovements: { queryOptions: mocks.queryOptions } } }

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => trpc,
}))

const now = new Date('2026-05-01T00:00:00.000Z')

const item: ClientInventoryItem = {
    id: 'item-1',
    name: 'Party pies',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'quantity',
    baseUnit: 'each',
    runningLowThreshold: 10,
    createdAt: now,
    updatedAt: now,
}

const staff = { $type: 'staff', uid: 'uid-1', email: 'staff@fizzkidz.com.au' } as const
const system = { $type: 'system' } as const

function movement(overrides: Record<string, unknown>) {
    return {
        id: `movement-${String(overrides.$type)}-${String(overrides.id ?? '')}`,
        itemId: 'item-1',
        location: 'balwyn',
        createdAt: '2026-05-01T10:30:00.000Z',
        createdBy: staff,
        ...overrides,
    }
}

describe('StockHistory', () => {
    beforeEach(() => {
        mocks.query = { data: undefined, isPending: false }
        mocks.queryOptions.mockClear()
    })

    afterEach(() => {
        cleanup()
    })

    it('shows a loader while movements load', () => {
        mocks.query = { data: undefined, isPending: true }

        const { rerender } = render(<StockHistory item={item} location="balwyn" />)
        rerender(<StockHistory item={item} location="balwyn" />)

        expect(screen.getByText('Loading history')).toBeTruthy()
        expect(mocks.queryOptions).toHaveBeenCalledWith({ location: 'balwyn', itemId: 'item-1', limit: 100 })
    })

    it('shows an empty state when there is no history', () => {
        const { rerender } = render(<StockHistory item={item} location="balwyn" />)
        expect(screen.getByText('No stock changes yet.')).toBeTruthy()

        mocks.query = { data: [], isPending: false }
        rerender(<StockHistory item={item} location="balwyn" />)
        expect(screen.getByText('No stock changes yet.')).toBeTruthy()
    })

    it('describes every movement type with its change and author', () => {
        mocks.query = {
            isPending: false,
            data: [
                movement({ $type: 'received', quantity: 5, quantityBefore: 1, quantityAfter: 6, reason: 'Delivery' }),
                movement({ $type: 'counted', quantityBefore: 6, quantityAfter: 4 }),
                movement({ $type: 'counted', id: 'unknown', quantityBefore: null, quantityAfter: null }),
                movement({ $type: 'removed', quantity: 1, quantityBefore: 4, quantityAfter: 3 }),
                movement({ $type: 'level-updated', levelBefore: 'high', levelAfter: 'low' }),
                movement({
                    $type: 'reserved',
                    bookingId: 'b1',
                    quantity: 2,
                    reservedBefore: 0,
                    reservedAfter: 2,
                    createdBy: system,
                }),
                movement({ $type: 'released', bookingId: 'b1', quantity: 1, reservedBefore: 2, reservedAfter: 1 }),
                movement({
                    $type: 'used',
                    bookingId: 'b1',
                    quantity: 1,
                    quantityBefore: 3,
                    quantityAfter: 2,
                    reservedBefore: 1,
                    reservedAfter: 0,
                }),
            ],
        }

        const { rerender } = render(<StockHistory item={item} location="balwyn" />)
        rerender(<StockHistory item={item} location="balwyn" />)

        expect(screen.getByText('Received 5')).toBeTruthy()
        expect(screen.getByText('“Delivery”')).toBeTruthy()
        expect(screen.getByText('Counted 4')).toBeTruthy()
        expect(screen.getByText('Count marked unknown')).toBeTruthy()
        expect(screen.getByText(/On hand unknown → unknown/)).toBeTruthy()
        expect(screen.getByText('Removed 1')).toBeTruthy()
        expect(screen.getByText('Level set to Low')).toBeTruthy()
        expect(screen.getByText(/High → Low/)).toBeTruthy()
        expect(screen.getByText('Reserved 2 for a party')).toBeTruthy()
        expect(screen.getByText(/Reserved 0 → 2 · Automatic/)).toBeTruthy()
        expect(screen.getByText('Released 1 back to stock')).toBeTruthy()
        expect(screen.getByText('Used 1 at a party')).toBeTruthy()
        expect(screen.getByText(/On hand 3 → 2 · staff@fizzkidz.com.au/)).toBeTruthy()
        expect(screen.getAllByText(/^\d{1,2} May 2026, \d{1,2}:\d{2}[AP]M$/)).toHaveLength(8)
    })

    it('throws on an unknown movement type', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.query = { isPending: false, data: [movement({ $type: 'teleported' })] }

        expect(() => render(<StockHistory item={item} location="balwyn" />)).toThrow('Unhandled movement.$type')
        vi.mocked(console.error).mockRestore()
    })
})
