// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { PartyCapacityUtilisationReport } from './party-capacity-utilisation-report'

import type { ReactNode } from 'react'

let currentOrg: 'master' | 'balwyn' = 'balwyn'
let queryInput: unknown
let queryEnabled: boolean | undefined
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
                queryOptions: (input: unknown, opts?: { enabled?: boolean }) => ({ input, ...opts }),
            },
        },
    }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: (options: { input: unknown; enabled?: boolean }) => {
        queryInput = options.input
        queryEnabled = options.enabled
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
                onClick={() =>
                    onSelect({
                        from: new Date('2026-09-01T00:00:00'),
                        to: new Date('2026-09-30T00:00:00'),
                    })
                }
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
        queryEnabled = undefined
        queryResult = undefined
        isQueryError = false
    })

    afterEach(() => {
        cleanup()
        vi.useRealTimers()
    })

    it('only loads the report once the panel is expanded', () => {
        render(<PartyCapacityUtilisationReport />)
        expect(queryEnabled).toBe(false)

        expandReport()
        expect(queryEnabled).toBe(true)
    })

    it('runs the upcoming 90-day report immediately without manual capacity', () => {
        render(<PartyCapacityUtilisationReport />)

        expect(queryInput).toEqual({
            startDate: '2026-08-24',
            endDate: '2026-11-21',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
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
        fireEvent.change(screen.getByLabelText('Date range'), {
            target: { value: 'custom' },
        })
        expect(screen.getByTestId('capacity-calendar').dataset.mode).toBe('range')
        fireEvent.click(screen.getByText('Select September'))

        expect(queryInput).toEqual({
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
        })
    })

    it('reruns immediately for each preset date range', () => {
        render(<PartyCapacityUtilisationReport />)
        expandReport()
        const preset = screen.getByLabelText('Date range')

        fireEvent.change(preset, { target: { value: 'current-month' } })
        expect(queryInput).toEqual({
            startDate: '2026-08-01',
            endDate: '2026-08-31',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
        })

        fireEvent.change(preset, { target: { value: 'upcoming-month' } })
        expect(queryInput).toEqual({
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
        })

        fireEvent.change(preset, { target: { value: 'next-30-days' } })
        expect(queryInput).toEqual({
            startDate: '2026-08-24',
            endDate: '2026-09-22',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
        })

        fireEvent.change(preset, { target: { value: 'until-end-of-year' } })
        expect(queryInput).toEqual({
            startDate: '2026-08-24',
            endDate: '2026-12-31',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
        })
    })

    it('waits for a complete custom range without showing a loading state', () => {
        render(<PartyCapacityUtilisationReport />)
        expandReport()

        fireEvent.change(screen.getByLabelText('Date range'), {
            target: { value: 'custom' },
        })
        fireEvent.click(screen.getByText('Select start only'))

        expect(queryInput).toEqual({
            startDate: '2026-09-01',
            endDate: '',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
        })
        expect(screen.getByText('Select an end date to update the report.')).toBeTruthy()
        expect(screen.queryByText('Loading capacity report...')).toBeNull()
    })

    it('includes both party types by default and lets you report on one type', () => {
        render(<PartyCapacityUtilisationReport />)
        expandReport()

        const inStudio = screen.getByRole('button', { name: 'In-studio' })
        const atHome = screen.getByRole('button', { name: 'At home' })
        expect(inStudio.getAttribute('aria-pressed')).toBe('true')
        expect(atHome.getAttribute('aria-pressed')).toBe('true')

        fireEvent.click(inStudio)
        expect(queryInput).toEqual(expect.objectContaining({ partyTypes: ['mobile'] }))
        expect(inStudio.getAttribute('aria-pressed')).toBe('false')
        expect((atHome as HTMLButtonElement).disabled).toBe(true)

        fireEvent.click(inStudio)
        fireEvent.click(atHome)
        expect(queryInput).toEqual(expect.objectContaining({ partyTypes: ['studio'] }))
        expect((inStudio as HTMLButtonElement).disabled).toBe(true)

        fireEvent.click(atHome)
        expect(queryInput).toEqual(expect.objectContaining({ partyTypes: ['studio', 'mobile'] }))
    })

    it('renders the calculated capacity returned by the report', () => {
        queryResult = {
            startDate: '2026-08-24',
            endDate: '2026-11-21',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
            overall: {
                bookedSlots: 32,
                availableSlots: 64,
                utilisationPercentage: 50,
                byPartyType: [],
            },
            studios: [
                {
                    studio: 'balwyn',
                    bookedSlots: 32,
                    availableSlots: 64,
                    utilisationPercentage: 50,
                    byPartyType: [],
                    weeks: [
                        {
                            startDate: '2026-08-24',
                            endDate: '2026-08-30',
                            bookedSlots: 5,
                            availableSlots: 9,
                            utilisationPercentage: (5 / 9) * 100,
                            byPartyType: [],
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

    it('breaks utilisation down by party type when both are selected', () => {
        const byPartyType = [
            { type: 'studio', bookedSlots: 6, availableSlots: 8, utilisationPercentage: 75 },
            { type: 'mobile', bookedSlots: 1, availableSlots: 2, utilisationPercentage: 50 },
        ]
        const summary = { bookedSlots: 7, availableSlots: 10, utilisationPercentage: 70, byPartyType }
        queryResult = {
            startDate: '2026-08-24',
            endDate: '2026-08-30',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
            overall: summary,
            studios: [
                {
                    studio: 'balwyn',
                    ...summary,
                    weeks: [{ startDate: '2026-08-24', endDate: '2026-08-30', ...summary }],
                },
            ],
            weeks: [],
        }

        render(<PartyCapacityUtilisationReport />)
        expandReport()

        expect(screen.getByText('70%')).toBeTruthy()
        expect(screen.getByText('(6 of 8)')).toBeTruthy()
        expect(screen.getByText('(1 of 2)')).toBeTruthy()
        expect(screen.getByText('70% full')).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: /Balwyn Studio/ }))
        // Overall card, studio heading and the week row each show both types
        expect(screen.getAllByText('75%')).toHaveLength(3)
        expect(screen.getAllByText('50%')).toHaveLength(3)
    })

    it('shows a dash instead of a percentage for periods with no available slots', () => {
        queryResult = {
            startDate: '2026-12-21',
            endDate: '2026-12-27',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
            overall: { bookedSlots: 0, availableSlots: 0, utilisationPercentage: 0, byPartyType: [] },
            studios: [
                {
                    studio: 'balwyn',
                    bookedSlots: 0,
                    availableSlots: 0,
                    utilisationPercentage: 0,
                    byPartyType: [],
                    weeks: [
                        {
                            startDate: '2026-12-21',
                            endDate: '2026-12-27',
                            bookedSlots: 0,
                            availableSlots: 0,
                            utilisationPercentage: 0,
                            byPartyType: [],
                        },
                    ],
                },
            ],
            weeks: [],
        }

        render(<PartyCapacityUtilisationReport />)
        expandReport()
        fireEvent.click(screen.getByRole('button', { name: /Balwyn Studio/ }))

        expect(screen.queryByText(/0%/)).toBeNull()
        expect(screen.getAllByText('–')).toHaveLength(3)
    })

    it('renders one row per studio for a master report', () => {
        currentOrg = 'master'
        queryResult = {
            startDate: '2026-08-24',
            endDate: '2026-11-21',
            studio: 'master',
            partyTypes: ['studio', 'mobile'],
            overall: {
                bookedSlots: 31,
                availableSlots: 40,
                utilisationPercentage: 77.5,
                byPartyType: [],
            },
            studios: [
                {
                    studio: 'balwyn',
                    bookedSlots: 17,
                    availableSlots: 20,
                    utilisationPercentage: 85,
                    byPartyType: [],
                    weeks: [],
                },
                {
                    studio: 'kingsville',
                    bookedSlots: 14,
                    availableSlots: 20,
                    utilisationPercentage: 70,
                    byPartyType: [],
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
                    byPartyType: [],
                    studios: [
                        {
                            studio: 'balwyn',
                            bookedSlots: 5,
                            availableSlots: 9,
                            utilisationPercentage: (5 / 9) * 100,
                            byPartyType: [],
                        },
                        {
                            studio: 'kingsville',
                            bookedSlots: 3,
                            availableSlots: 9,
                            utilisationPercentage: (3 / 9) * 100,
                            byPartyType: [],
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
