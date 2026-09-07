import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Booking, PartyForm } from '@fizz-kidz/core'

import { handlePartyFormSubmission } from '../handle-party-form-submission'

import type { PaperformSubmission } from '@/integrations/paperforms/paperform.client'

const mocks = vi.hoisted(() => ({
    getBooking: vi.fn(),
    snapshot: vi.fn(),
    getSubmission: vi.fn(),
    apply: vi.fn(),
    mark: vi.fn(),
    send: vi.fn(),
    mapped: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: {
        getPartyBooking: mocks.getBooking,
        getPartyFormV2BookingSnapshot: mocks.snapshot,
        getPartyFormV2Submission: mocks.getSubmission,
        applyPartyFormV2BookingUpdate: mocks.apply,
        markPartyFormV2NotificationSent: mocks.mark,
    },
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

describe('paid party fulfilment recovery', () => {
    it('retries unfinished supplier notifications after the booking write without adding quantities or resending completed notifications', async () => {
        const original: Partial<Booking> = {
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
            partyFormFilledIn: false,
        }
        const mapped = {
            ...original,
            partyFormFilledIn: true,
            numberOfChildren: 12,
            takeHomeBags: { lollyBags: 12 },
            products: {},
            cake: {
                selection: 'Rainbow Ice-Cream Cake',
                size: 'Small',
                flavours: ['Vanilla'],
                served: 'Bring own bowls',
                candles: 'Bring own candles',
                message: '',
            },
        }
        let booking = original
        let bookingApplied = false
        const notifications: Record<string, boolean> = {}
        mocks.getBooking.mockImplementation(async () => booking)
        mocks.snapshot.mockResolvedValue(original)
        mocks.getSubmission.mockImplementation(async () => ({ notifications: { ...notifications } }))
        mocks.mapped.mockReturnValue(mapped)
        mocks.apply.mockImplementation(async (_id, _bookingId, buildUpdate) => {
            if (!bookingApplied) {
                booking = { ...booking, ...buildUpdate(booking) }
                bookingApplied = true
            }
        })
        mocks.mark.mockImplementation(async (_id, notification) => {
            notifications[notification] = true
        })
        let failed = false
        mocks.send.mockImplementation(async (template) => {
            if (template === 'cakeNotification' && !failed) {
                failed = true
                throw new Error('Supplier email unavailable')
            }
        })

        await expect(handlePartyFormSubmission(responses, 'submission')).rejects.toThrow('Supplier email unavailable')
        expect(booking.takeHomeBags?.lollyBags).toBe(12)
        await handlePartyFormSubmission(responses, 'submission')
        expect(booking.takeHomeBags?.lollyBags).toBe(12)
        const sent = mocks.send.mock.calls.map(([template]) => template)
        expect(sent.filter((name) => name === 'takeHomeNotification')).toHaveLength(1)
        expect(sent.filter((name) => name === 'cakeNotification')).toHaveLength(2)
        expect(sent.filter((name) => name === 'takeHomeBagNotification')).toHaveLength(1)
        expect(sent.filter((name) => name === 'partyFormConfirmation')).toHaveLength(1)
        expect(notifications.cakeNotification).toBe(true)
        expect(notifications.takeHomeBagNotification).toBe(true)
    })
})
