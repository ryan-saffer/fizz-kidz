// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ManageBookingPage } from './manage-booking-page'

const mocks = vi.hoisted(() => ({
    load: vi.fn(),
    sessions: vi.fn(),
    refund: vi.fn(),
    cancel: vi.fn(),
    reschedule: vi.fn(),
}))
vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        programBookings: {
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
            cancellationRefund: {
                queryOptions: (input: unknown, options: object) => ({
                    ...options,
                    queryKey: ['refund', input],
                    queryFn: mocks.refund,
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
const appointment = (canReschedule = true, program = 'holiday-program') => ({
    id: 123,
    program,
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
                    <Route path="/programs/manage/:appointmentId" element={<ManageBookingPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
    return userEvent.setup()
}

describe('manage program booking page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.load.mockResolvedValue(appointment())
        mocks.sessions.mockResolvedValue([
            { id: 11, time: '2026-10-06T10:00:00+10:00', title: 'Slime time', duration: 180, slotsAvailable: 1 },
            { id: 12, time: '2026-10-07T10:00:00+10:00', title: 'Full session', duration: 180, slotsAvailable: 0 },
        ])
        mocks.refund.mockResolvedValue({ refundCents: 6500, fullTermDiscountRemoved: false })
        mocks.cancel.mockResolvedValue({})
        mocks.reschedule.mockResolvedValue({})
    })
    afterEach(cleanup)

    it('disables rescheduling inside 48 hours but allows cancelling', async () => {
        mocks.load.mockResolvedValue(appointment(false))
        mocks.refund.mockResolvedValue({ refundCents: 0, fullTermDiscountRemoved: false })
        const user = showPage()
        expect(
            ((await screen.findByRole('button', { name: 'Reschedule session' })) as HTMLButtonElement).disabled
        ).toBe(true)
        await user.click(screen.getByRole('button', { name: 'Cancel session' }))
        const dialog = screen.getByRole('dialog')
        expect(await within(dialog).findByText(/less than 48 hours/)).toBeTruthy()
        expect(within(dialog).getByText(/No refund/)).toBeTruthy()
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

    it('shows the refund before cancelling', async () => {
        const user = showPage()
        expect(await screen.findByRole('heading', { name: 'Manage your holiday program booking' })).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Cancel session' }))
        expect(
            await within(screen.getByRole('dialog')).findByText(/\$65\.00 to your original payment method/)
        ).toBeTruthy()
    })

    it('explains when cancelling removes the preschool full-term discount', async () => {
        mocks.load.mockResolvedValue(appointment(true, 'preschool-program'))
        mocks.refund.mockResolvedValue({ refundCents: 120, fullTermDiscountRemoved: true })
        const user = showPage()
        expect(await screen.findByRole('heading', { name: 'Manage your Preschool Program booking' })).toBeTruthy()
        expect(screen.getByText(/Preschool Program cancellation and rescheduling policy/)).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Cancel session' }))
        const dialog = screen.getByRole('dialog')
        expect(await within(dialog).findByText(/\$1\.20 to your original payment method/)).toBeTruthy()
        expect(within(dialog).getByText(/no longer covers the full term/)).toBeTruthy()
    })
})
