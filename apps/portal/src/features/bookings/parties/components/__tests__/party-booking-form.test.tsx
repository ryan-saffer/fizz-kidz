// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import { usePartyBookingsStore, type PartyBookingServer } from '../../state/party-bookings-store'
import { PartyBookingForm } from '../form/party-booking-form'

vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        creations: {
            getBirthdayPartyBookingCatalogue: {
                queryOptions: () => ({
                    queryKey: ['catalogue'],
                    queryFn: async () => ({
                        creations: [
                            {
                                key: 'slime',
                                name: 'Fluffy Slime',
                                bookingChannels: ['studio'],
                                legacyLabels: [],
                                status: 'active',
                            },
                        ],
                        packages: [
                            { key: 'glam', name: 'Glam', position: 1, status: 'active', creations: [{ key: 'slime' }] },
                        ],
                    }),
                }),
            },
        },
    }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const server = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getPartyFormUrl: vi.fn(),
    getCakeFormUrl: vi.fn(),
    resendConfirmationEmail: vi.fn(),
} satisfies PartyBookingServer
const showDate = vi.fn()

const booking = {
    id: 'booking-1',
    eventId: 'event-1',
    parentFirstName: 'Jane',
    parentLastName: 'Smith',
    parentEmail: 'jane@example.com',
    parentMobile: '0412345678',
    childName: 'Mia',
    childAge: '6',
    location: 'balwyn',
    type: 'studio',
    partyLength: '1.5',
    address: '',
    numberOfChildren: '',
    notes: '',
    creation1: 'slime',
    creation2: undefined,
    creation3: undefined,
    questions: '',
    funFacts: '',
    includesFood: true,
    partyFormFilledIn: false,
    sendConfirmationEmail: true,
    oldPrices: false,
    useRsvpSystem: true,
    dateTime: { toDate: () => new Date('2026-07-11T00:00:00.000Z') },
} as unknown as WithId<FirestoreBooking>

function renderForm() {
    const dialog = usePartyBookingsStore.getState().dialog!
    return render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <PartyBookingForm dialog={dialog} />
        </QueryClientProvider>
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
    )
    usePartyBookingsStore.setState({ dialog: null, deleting: null, busyBookingId: null })
    usePartyBookingsStore.getState().register({ server, showDate })
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

describe('PartyBookingForm', () => {
    it('shows what is missing on a new booking instead of booking it', async () => {
        usePartyBookingsStore.getState().openCreate()
        renderForm()

        await userEvent.click(screen.getByRole('button', { name: 'Book party' }))

        expect(await screen.findByText('Enter the parent’s first name')).toBeTruthy()
        expect(screen.getByText('Choose studio or mobile')).toBeTruthy()
        expect(screen.getByText('Choose the child’s birthday')).toBeTruthy()
        expect(server.create).not.toHaveBeenCalled()
    })

    it('asks for an address rather than food on a prefilled mobile party', () => {
        usePartyBookingsStore.getState().openCreate({ type: 'mobile', parentFirstName: 'Jane' })
        renderForm()

        expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Jane')
        expect(screen.getByLabelText('Party address')).toBeTruthy()
        expect(screen.queryByText('Food package')).toBeNull()
    })

    it('adds and removes birthday children', async () => {
        usePartyBookingsStore.getState().openCreate()
        renderForm()

        await userEvent.click(screen.getByRole('button', { name: /Add child/ }))
        expect(screen.getAllByLabelText('Name')).toHaveLength(2)

        await userEvent.click(screen.getByRole('button', { name: 'Remove child 2' }))
        expect(screen.getAllByLabelText('Name')).toHaveLength(1)
    })

    it('saves an edited booking over the existing one and closes the dialog', async () => {
        server.update.mockResolvedValue(undefined)
        usePartyBookingsStore.getState().openEdit(booking)
        renderForm()

        expect(screen.getByLabelText('Creation 1')).toBeTruthy()
        await userEvent.type(screen.getByLabelText('Staff notes'), 'Nut allergy')
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

        await waitFor(() => expect(server.update).toHaveBeenCalledTimes(1))
        const { bookingId, booking: saved } = server.update.mock.calls[0][0]
        expect(bookingId).toBe('booking-1')
        expect(saved).toMatchObject({
            eventId: 'event-1',
            notes: 'Nut allergy',
            creation1: 'slime',
            includesFood: true,
        })
        expect(saved).not.toHaveProperty('id')
        expect(usePartyBookingsStore.getState().dialog).toBeNull()
        expect(showDate).toHaveBeenCalled()
    })

    it('keeps the dialog open when saving fails', async () => {
        server.update.mockRejectedValue(new Error('Calendar unavailable'))
        usePartyBookingsStore.getState().openEdit(booking)
        renderForm()

        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

        await waitFor(() => expect(server.update).toHaveBeenCalled())
        expect(usePartyBookingsStore.getState().dialog).not.toBeNull()
    })
})
