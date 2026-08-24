// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { HolidayProgramCapacityReport } from './holiday-program-capacity-report'

vi.mock('@session/use-org', () => ({
    useOrg: () => ({ currentOrg: 'balwyn' }),
}))

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        reports: {
            generateHolidayProgramCapacityReport: {
                queryOptions: (input: unknown) => ({ input }),
            },
        },
    }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({
        data: undefined,
        isPending: false,
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
    }),
}))

describe('HolidayProgramCapacityReport', () => {
    afterEach(cleanup)

    it('is collapsed by default and expands from its header', () => {
        render(<HolidayProgramCapacityReport />)

        expect(screen.queryByText('Reporting on:')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /Holiday Program Capacity/ }))
        expect(screen.getByText('Reporting on:')).toBeTruthy()
    })
})
