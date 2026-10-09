import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Booking, PartyForm } from '@fizz-kidz/core'

import { handlePartyFormSubmission } from '../handle-party-form-submission'

import type { PaperformSubmission } from '@/integrations/paperforms/paperform.client'

const mocks = vi.hoisted(() => ({ getBooking: vi.fn(), update: vi.fn(), send: vi.fn(), mapped: vi.fn() }))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: { getPartyBooking: mocks.getBooking, updatePartyBooking: mocks.update },
}))
vi.mock('@/integrations/sanity/sanity.client', () => ({
    SanityClient: { getInstance: async () => ({ getBirthdayPartyBookingCatalogue: async () => ({}) }) },
}))
vi.mock('../party-form-mapper', () => ({
    PartyFormMapper: class {
        bookingId = 'booking'
        mapToBooking = mocks.mapped
        getCreationDisplayValues() {
            return ['Fluffy Slime', 'Crunchy Slime']
        }
        getAdditionDisplayValues() {
            return []
        }
    },
}))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.send }) },
}))
vi.mock('@/integrations/mixpanel/mixpanel.client', () => ({
    MixpanelClient: { getInstance: async () => ({ track: vi.fn() }) },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))

const responses = { getFieldValue: () => 'party' } as unknown as PaperformSubmission<PartyForm>
beforeEach(() => {
    vi.clearAllMocks()
})

describe('handling a party form submission', () => {
    it('stores the custom form cake, and a failed supplier email is logged without failing the submission', async () => {
        const booking: Partial<Booking> = {
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
        }
        const cake: Booking['cake'] = {
            selection: 'Rainbow Ice-Cream Cake',
            size: 'Small',
            flavours: ['Vanilla'],
            served: 'Bring own bowls',
            candles: 'Bring own candles',
        }
        mocks.getBooking.mockResolvedValue(booking)
        mocks.mapped.mockReturnValue({ numberOfChildren: 12 })
        mocks.send.mockImplementation(async (template) => {
            if (template === 'cakeNotification') throw new Error('Supplier email unavailable')
        })

        await handlePartyFormSubmission(responses, cake)

        expect(mocks.update).toHaveBeenCalledWith('booking', expect.objectContaining({ cake, partyFormFilledIn: true }))
        expect(mocks.send.mock.calls.map(([template]) => template)).toEqual(
            expect.arrayContaining(['cakeNotification', 'partyFormConfirmation'])
        )
    })
})
