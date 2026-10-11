import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Booking, PartyForm } from '@fizz-kidz/core'

import { applyPartyForm } from '../apply-party-form'

const mocks = vi.hoisted(() => ({ update: vi.fn(), send: vi.fn(), track: vi.fn() }))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: { updatePartyBooking: mocks.update } }))
vi.mock('@/integrations/sanity/sanity.client', () => ({
    SanityClient: {
        getInstance: async () => ({
            getBirthdayPartyBookingCatalogue: async () => ({
                creations: [
                    { key: 'fluffySlime', name: 'Fluffy Slime', legacyLabels: [] },
                    { key: 'crunchySlime', name: 'Crunchy Slime', legacyLabels: [] },
                ],
                packages: [],
            }),
        }),
    },
}))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.send }) },
}))
vi.mock('@/integrations/mixpanel/mixpanel.client', () => ({
    MixpanelClient: { getInstance: async () => ({ track: mocks.track }) },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))

const booking = {
    type: 'studio',
    location: 'malvern',
    partyLength: '1.5',
    parentFirstName: 'Alex',
    parentLastName: 'Smith',
    parentEmail: 'alex@example.com',
    parentMobile: '0400000000',
    childName: 'Charlie',
    dateTime: new Date('2026-10-01'),
    includesFood: true,
    takeHomeBags: { lollyBags: 12 },
} as Booking
const cake = {
    selection: 'Rainbow Ice-Cream Cake',
    size: 'Small (12-15 serves)',
    flavours: ['Vanilla'],
    served: 'Waffle Cones',
    candles: 'Include candles',
}
const partyForm: PartyForm = {
    mode: 'party',
    bookingId: 'booking',
    parentFirstName: 'Alex',
    parentLastName: 'Smith',
    childName: 'Charlie',
    childAge: '7',
    numberOfChildren: '12 - 15',
    foodPackage: 'include',
    additions: ['fairyBread'],
    creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'crunchySlime'] }],
    cake,
    takeHomeBags: { lollyBags: 3 },
    products: {},
}
const sent = () => mocks.send.mock.calls.map(([template]) => template)

beforeEach(() => vi.clearAllMocks())

describe('applying a party form to its booking', () => {
    it('saves the answers, adding goodies to earlier orders, and sends the confirmation and supplier emails', async () => {
        await applyPartyForm(partyForm, booking)
        expect(mocks.update).toHaveBeenCalledWith(
            'booking',
            expect.objectContaining({
                creation1: 'fluffySlime',
                creation2: 'crunchySlime',
                fairyBread: true,
                cake,
                takeHomeBags: { lollyBags: 15 },
                partyFormFilledIn: true,
            })
        )
        expect(sent()).toEqual(
            expect.arrayContaining(['takeHomeNotification', 'cakeNotification', 'takeHomeBagNotification'])
        )
        expect(mocks.send).toHaveBeenCalledWith(
            'partyFormConfirmation',
            'alex@example.com',
            expect.objectContaining({ creations: ['Fluffy Slime', 'Crunchy Slime'] }),
            expect.anything()
        )
        expect(mocks.track).toHaveBeenCalledWith(
            'birthday-party-form-completed',
            expect.objectContaining({ partyOrCakeForm: 'party', cakeOrdered: true })
        )
    })
    it('logs a failed supplier email without failing the submission', async () => {
        mocks.send.mockImplementation(async (template) => {
            if (template === 'cakeNotification') throw new Error('Supplier email unavailable')
        })
        await expect(applyPartyForm(partyForm, booking)).resolves.toBeUndefined()
        expect(sent()).toContain('partyFormConfirmation')
    })
    it('confirms a cake form order without touching the party details or sending party form emails', async () => {
        await applyPartyForm(
            { mode: 'cake', bookingId: 'booking', cake, takeHomeBags: {}, products: {} },
            { ...booking, partyFormFilledIn: true }
        )
        expect(mocks.update).toHaveBeenCalledWith('booking', {
            cake,
            takeHomeBags: { lollyBags: 12 },
            products: {},
        })
        expect(sent()).toContain('cakeFormConfirmation')
        expect(sent()).not.toContain('partyFormConfirmation')
        expect(sent()).not.toContain('partyFormFilledInAgain')
    })
})
