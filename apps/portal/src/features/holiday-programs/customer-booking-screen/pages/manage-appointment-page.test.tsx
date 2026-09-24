// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ManageAppointmentPage } from './manage-appointment-page'

const mocks = vi.hoisted(() => ({ load: vi.fn(), sessions: vi.fn(), cancel: vi.fn(), reschedule: vi.fn() }))
vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        holidayPrograms: {
            getManagedAppointment: {
                queryKey: (input: unknown) => ['appointment', input],
                queryOptions: (input: unknown, options: object) => ({
                    ...options,
                    queryKey: ['appointment', input],
                    queryFn: mocks.load,
                }),
            },
            rescheduleSessions: {
                queryOptions: (input: unknown, options: object) => ({
                    ...options,
                    queryKey: ['sessions', input],
                    queryFn: mocks.sessions,
                }),
            },
            cancelAppointment: { mutationOptions: (options: object) => ({ ...options, mutationFn: mocks.cancel }) },
            rescheduleAppointment: {
                mutationOptions: (options: object) => ({ ...options, mutationFn: mocks.reschedule }),
            },
        },
    }),
}))

const token = 'a'.repeat(64)
const appointment = (canReschedule = true) => ({
    id: 123,
    childName: 'Alex',
    datetime: '2026-10-04T10:00:00+10:00',
    duration: '180',
    studio: 'Malvern',
    address: 'Studio address',
    canceled: false,
    canCancel: true,
    canReschedule,
})

function showPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[`/programs/manage/123#token=${token}`]}>
                <Routes>
                    <Route path="/programs/manage/:appointmentId" element={<ManageAppointmentPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
    return userEvent.setup()
}

describe('manage holiday program page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.load.mockResolvedValue(appointment())
        mocks.sessions.mockResolvedValue([
            { id: 11, time: '2026-10-06T10:00:00+10:00', title: 'Slime time', duration: 180, slotsAvailable: 1 },
            { id: 12, time: '2026-10-07T10:00:00+10:00', title: 'Full session', duration: 180, slotsAvailable: 0 },
        ])
        mocks.cancel.mockResolvedValue({})
        mocks.reschedule.mockResolvedValue({})
    })
    afterEach(cleanup)

    it('disables rescheduling inside 48 hours but allows cancelling', async () => {
        mocks.load.mockResolvedValue(appointment(false))
        const user = showPage()
        expect(
            ((await screen.findByRole('button', { name: 'Reschedule session' })) as HTMLButtonElement).disabled
        ).toBe(true)
        await user.click(screen.getByRole('button', { name: 'Cancel session' }))
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText(/will not be refunded/)).toBeTruthy()
        await user.click(within(dialog).getByRole('button', { name: 'Yes, cancel session' }))
        await screen.findByText(/Your session has been cancelled/)
        expect(mocks.cancel.mock.calls[0][0]).toEqual({ appointmentId: 123, token })
    })

    it('reschedules to a selected session', async () => {
        const user = showPage()
        await user.click(await screen.findByRole('button', { name: 'Reschedule session' }))
        expect((screen.getByRole('radio', { name: /Full session/ }) as HTMLInputElement).disabled).toBe(true)
        await user.click(await screen.findByRole('radio', { name: /Slime time/ }))
        await user.click(screen.getByRole('button', { name: 'Continue' }))
        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm reschedule' }))
        await screen.findByText(/Your session has been rescheduled/)
        expect(mocks.reschedule.mock.calls[0][0]).toEqual({ appointmentId: 123, token, classId: 11 })
    })
})
