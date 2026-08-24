// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { PartyCapacityUtilisationReport } from './party-capacity-utilisation-report'

import type { ReactNode } from 'react'

let currentOrg: 'master' | 'balwyn' = 'balwyn'
let queryInput: unknown
let queryResult: unknown
let isQueryError = false

vi.mock('@session/use-org', () => ({
    useOrg: () => ({ currentOrg }),
}))

vi.mock('@shared/lib/studio-utils', () => ({
    getOrgName: (org: string) => {
        if (org === 'master') return 'Corporate Studios'
        return `${org.charAt(0).toUpperCase()}${org.slice(1)} Studio`
    },
}))

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        reports: {
            generateCapacityReport: {
                queryOptions: (input: unknown) => ({ input }),
            },
        },
    }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: (options: { input: unknown }) => {
        queryInput = options.input
        return {
            data: queryResult,
            isPending: false,
            isFetching: false,
            isError: isQueryError,
        }
    },
}))

vi.mock('@shared/components/ui/popover', () => ({
    Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@shared/components/ui/calendar', () => ({
    Calendar: ({ onSelect, mode }: { onSelect: (range: unknown) => void; mode: string }) => (
        <div data-testid="capacity-calendar" data-mode={mode}>
            <button
                type="button"
                onClick={() => onSelect({ from: new Date('2026-09-01T00:00:00'), to: new Date('2026-09-30T00:00:00') })}
            >
                Select September
            </button>
            <button type="button" onClick={() => onSelect({ from: new Date('2026-09-01T00:00:00') })}>
                Select start only
            </button>
        </div>
    ),
}))

vi.mock('@shared/components/ui/select', () => ({
    Select: ({
        children,
        value,
        onValueChange,
    }: {
        children: ReactNode
        value: string
        onValueChange: (value: string) => void
    }) => (
        <select aria-label="Date range" value={value} onChange={(event) => onValueChange(event.target.value)}>
            {children}
        </select>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
        <option value={value}>{children}</option>
    ),
}))

const expandReport = () => fireEvent.click(screen.getByRole('button', { name: /Birthday Party Capacity/ }))

describe('PartyCapacityUtilisationReport', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-08-24T12:00:00+10:00'))
        currentOrg = 'balwyn'
        queryInput = undefined
        queryResult = undefined
        isQueryError = false
    })

    afterEach(() => {
        cleanup()
        vi.useRealTimers()
    })

    it('runs the upcoming 90-day report immediately without manual capacity', () => {
        render(<PartyCapacityUtilisationReport />)

        expect(queryInput).toEqual({
            startDate: '2026-08-24',
            endDate: '2026-11-21',
            studio: 'balwyn',
        })
        expect(screen.queryByLabelText('Date range')).toBeNull()
        expandReport()
        expect(screen.queryByLabelText(/Available booking slots/)).toBeNull()
        expect(screen.queryByRole('button', { name: 'Run report' })).toBeNull()
        expect(screen.getByRole('link', { name: /View slot schedule and calculations/ }).getAttribute('href')).toBe(
            'https://docs.google.com/spreadsheets/d/1gJ4H1THdA2l3FJt6r6XSq2c40YZTuU2ENzEEpPYJiXI/edit?usp=sharing'
        )
    })

    it('uses a range calendar and reruns when a complete range is selected', () => {
        render(<PartyCapacityUtilisationReport />)
        expandReport()

        expect(screen.queryByTestId('capacity-calendar')).toBeNull()
        fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'custom' } })
        expect(screen.getByTestId('capacity-calendar').dataset.mode).toBe('range')
        fireEvent.click(screen.getByText('Select September'))

        expect(queryInput).toEqual({
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            studio: 'balwyn',
        })
    })

    it('reruns immediately for each preset date range', () => {
        render(<PartyCapacityUtilisationReport />)
        expandReport()
        const preset = screen.getByLabelText('Date range')

        fireEvent.change(preset, { target: { value: 'current-month' } })
        expect(queryInput).toEqual({ startDate: '2026-08-01', endDate: '2026-08-31', studio: 'balwyn' })

        fireEvent.change(preset, { target: { value: 'upcoming-month' } })
        expect(queryInput).toEqual({ startDate: '2026-09-01', endDate: '2026-09-30', studio: 'balwyn' })

        fireEvent.change(preset, { target: { value: 'next-30-days' } })
        expect(queryInput).toEqual({ startDate: '2026-08-24', endDate: '2026-09-22', studio: 'balwyn' })

        fireEvent.change(preset, { target: { value: 'until-end-of-year' } })
        expect(queryInput).toEqual({ startDate: '2026-08-24', endDate: '2026-12-31', studio: 'balwyn' })
    })

    it('waits for a complete custom range without showing a loading state', () => {
        render(<PartyCapacityUtilisationReport />)
        expandReport()

        fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'custom' } })
        fireEvent.click(screen.getByText('Select start only'))

        expect(queryInput).toEqual({ startDate: '2026-09-01', endDate: '', studio: 'balwyn' })
        expect(screen.getByText('Select an end date to update the report.')).toBeTruthy()
        expect(screen.queryByText('Loading capacity report...')).toBeNull()
    })

    it('renders the calculated capacity returned by the report', () => {
        queryResult = {
            startDate: '2026-08-24',
            endDate: '2026-11-21',
            studio: 'balwyn',
            overall: { bookedSlots: 32, availableSlots: 64, utilisationPercentage: 50 },
            studios: [
                {
                    studio: 'balwyn',
                    bookedSlots: 32,
                    availableSlots: 64,
                    utilisationPercentage: 50,
                    weeks: [
                        {
                            startDate: '2026-08-24',
                            endDate: '2026-08-30',
                            bookedSlots: 5,
                            availableSlots: 9,
                            utilisationPercentage: (5 / 9) * 100,
                        },
                    ],
                },
            ],
            weeks: [],
        }

        render(<PartyCapacityUtilisationReport />)
        expandReport()

        expect(screen.getByText('50%')).toBeTruthy()
        expect(screen.getAllByText('32 of 64 slots booked')).toHaveLength(2)
        expect(screen.getByRole('button', { name: /Balwyn Studio/ })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: /Balwyn Studio/ }))
        expect(screen.getByText('24 Aug - 30 Aug')).toBeTruthy()
    })

    it('renders one row per studio for a master report', () => {
        currentOrg = 'master'
        queryResult = {
            startDate: '2026-08-24',
            endDate: '2026-11-21',
            studio: 'master',
            overall: { bookedSlots: 31, availableSlots: 40, utilisationPercentage: 77.5 },
            studios: [
                {
                    studio: 'balwyn',
                    bookedSlots: 17,
                    availableSlots: 20,
                    utilisationPercentage: 85,
                    weeks: [],
                },
                {
                    studio: 'kingsville',
                    bookedSlots: 14,
                    availableSlots: 20,
                    utilisationPercentage: 70,
                    weeks: [],
                },
            ],
            weeks: [
                {
                    startDate: '2026-08-24',
                    endDate: '2026-08-30',
                    bookedSlots: 8,
                    availableSlots: 18,
                    utilisationPercentage: (8 / 18) * 100,
                    studios: [
                        { studio: 'balwyn', bookedSlots: 5, availableSlots: 9, utilisationPercentage: (5 / 9) * 100 },
                        {
                            studio: 'kingsville',
                            bookedSlots: 3,
                            availableSlots: 9,
                            utilisationPercentage: (3 / 9) * 100,
                        },
                    ],
                },
            ],
        }

        render(<PartyCapacityUtilisationReport />)
        expandReport()

        expect(queryInput).toEqual(expect.objectContaining({ studio: 'master' }))
        expect(screen.getByText('Balwyn Studio')).toBeTruthy()
        expect(screen.getByText('Kingsville Studio')).toBeTruthy()
        expect(screen.getByText('85% full')).toBeTruthy()
        expect(screen.getByText('70% full')).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Weekly breakdown' }))
        expect(screen.getByRole('button', { name: /24 Aug - 30 Aug/ })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: /24 Aug - 30 Aug/ }))
        expect(screen.getByText('5 of 9 slots booked')).toBeTruthy()
    })
})
