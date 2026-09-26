// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import { usePartyBookingsStore } from '../../state/party-bookings-store'
import { PartyBookingCard } from '../party-booking-card'

let canEdit = true

vi.mock('@session/use-org', () => ({
    useOrg: () => ({ hasPermission: () => canEdit }),
}))

vi.mock('@shared/components/dialogs/confirmation/use-confirmation-dialog', () => ({
    useConfirm: () => async () => true,
}))

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
                        packages: [],
                    }),
                }),
            },
        },
    }),
}))

const booking = {
    id: 'booking-1',
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
    numberOfChildren: '14',
    notes: 'Arriving early',
    creation1: 'slime',
    questions: '',
    funFacts: '',
    includesFood: false,
    oldPrices: true,
    partyFormFilledIn: true,
    fairyBread: true,
    takeHomeBags: { lollyBags: 12 },
    // 10am in Melbourne
    dateTime: { toDate: () => new Date('2026-07-11T00:00:00.000Z') },
} as unknown as WithId<FirestoreBooking>

function renderCard() {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <PartyBookingCard booking={booking} />
        </QueryClientProvider>
    )
}

beforeEach(() => {
    canEdit = true
    usePartyBookingsStore.setState({ dialog: null })
})

afterEach(cleanup)

describe('PartyBookingCard', () => {
    it('shows the party at a glance and its details when opened', async () => {
        renderCard()

        expect(screen.getByText('10:00 am')).toBeTruthy()
        expect(screen.getByText('to 11:30 am')).toBeTruthy()
        expect(screen.getByText('Mia’s 6th'.replace('’', "'"))).toBeTruthy()
        expect(screen.getAllByText('Old prices').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Self-catered').length).toBeGreaterThan(0)
        expect(screen.queryByText('Arriving early')).toBeNull()

        await userEvent.click(screen.getByRole('button', { expanded: false }))

        expect(screen.getByText('Arriving early')).toBeTruthy()
        expect(screen.getByText('Fairy Bread')).toBeTruthy()
        expect(screen.getByText('Lolly Bags')).toBeTruthy()
        expect(screen.getByText('Party form done')).toBeTruthy()
        expect(await screen.findByText('Fluffy Slime')).toBeTruthy()
    })

    it('opens the booking for editing', async () => {
        renderCard()
        await userEvent.click(screen.getByRole('button', { expanded: false }))
        await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

        expect(usePartyBookingsStore.getState().dialog).toEqual({ mode: 'edit', booking })
    })

    it('copies a form link from the nested menu', async () => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
        const copyPartyFormLink = vi.fn()
        const copyCakeFormLink = vi.fn()
        usePartyBookingsStore.setState({ copyPartyFormLink, copyCakeFormLink })
        const user = userEvent.setup()
        renderCard()

        await user.click(screen.getByRole('button', { expanded: false }))
        await user.click(screen.getByRole('button', { name: 'More actions' }))
        expect(screen.queryByRole('menuitem', { name: 'Copy party form link' })).toBeNull()

        screen.getByRole('menuitem', { name: 'Copy form link' }).focus()
        await user.keyboard('{ArrowRight}')
        expect(await screen.findByRole('menuitem', { name: 'Party form' })).toBeTruthy()
        await user.keyboard('{Enter}')

        expect(copyPartyFormLink).toHaveBeenCalledWith(booking)
        expect(copyCakeFormLink).not.toHaveBeenCalled()
        vi.unstubAllGlobals()
    })

    it('hides editing from staff who can only view bookings', async () => {
        canEdit = false
        renderCard()
        await userEvent.click(screen.getByRole('button', { expanded: false }))

        expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    })
})
