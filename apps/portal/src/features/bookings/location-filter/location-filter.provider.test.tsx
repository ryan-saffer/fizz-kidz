// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { useLocationFilter } from './location-filter.hook'
import { FilterContextProvider } from './location-filter.provider'

let currentOrg: 'master' | 'balwyn' = 'balwyn'

vi.mock('@session/use-org', () => ({
    useOrg: () => ({ currentOrg }),
}))

function SelectedLocation() {
    const { selectedLocation } = useLocationFilter()
    return <div>{selectedLocation}</div>
}

describe('FilterContextProvider', () => {
    beforeEach(() => {
        localStorage.clear()
        currentOrg = 'balwyn'
    })

    afterEach(() => {
        cleanup()
    })

    it('replaces another studio cached by a scoped user', async () => {
        localStorage.setItem('selectedLocation', 'cheltenham')

        render(
            <FilterContextProvider>
                <SelectedLocation />
            </FilterContextProvider>
        )

        expect(screen.getByText('balwyn')).toBeTruthy()
        await waitFor(() => expect(localStorage.getItem('selectedLocation')).toBe('balwyn'))
    })

    it('preserves the cached filter for master users', () => {
        currentOrg = 'master'
        localStorage.setItem('selectedLocation', 'cheltenham')

        render(
            <FilterContextProvider>
                <SelectedLocation />
            </FilterContextProvider>
        )

        expect(screen.getByText('cheltenham')).toBeTruthy()
        expect(localStorage.getItem('selectedLocation')).toBe('cheltenham')
    })
})
