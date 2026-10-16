import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Booking } from '@fizz-kidz/core'

import { deletePartyBooking } from '../delete-party-booking'

const mocks = vi.hoisted(() => ({
    getBooking: vi.fn(),
    deleteBooking: vi.fn(),
    deleteEvent: vi.fn(),
    release: vi.fn(),
    sendEmail: vi.fn(),
    logError: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: { getPartyBooking: mocks.getBooking, deletePartyBooking: mocks.deleteBooking },
}))
vi.mock('@/integrations/google/calendar.client', () => ({
    CalendarClient: { getInstance: async () => ({ deleteEvent: mocks.deleteEvent }) },
}))
vi.mock('@/features/inventory/core/inventory.reservations', () => ({ releaseInventoryForBooking: mocks.release }))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))
vi.mock('@/integrations/zoho/zoho.client', () => ({ ZohoClient: vi.fn() }))
vi.mock('../rsvp/delete-invitation', () => ({ deleteInvitation: vi.fn() }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const cake = {
    selection: 'Unicorn',
    size: 'Medium',
    flavours: ['Chocolate'],
    served: 'Bowls and spoons',
    candles: 'Plain candles',
}

function booking(location: Booking['location'], order: Partial<Booking> = {}) {
    return {
        type: 'studio',
        location,
        dateTime: new Date('2026-11-14T00:00:00.000Z'),
        partyLength: '1.5',
        childName: 'Max',
        parentFirstName: 'Jane',
        parentLastName: 'Smith',
        parentEmail: 'jane@example.com',
        parentMobile: '0400000000',
        address: '',
        ...order,
    } as Booking
}

const cancel = (location: Booking['location']) =>
    deletePartyBooking({
        bookingId: 'b1',
        eventId: 'event-1',
        location,
        type: 'studio',
        lostReason: 'Change of Plans',
        lostReasonOtherDetails: undefined,
    })

const emailsSent = (email: string) => mocks.sendEmail.mock.calls.filter(([name]) => name === email)

beforeEach(() => vi.clearAllMocks())

describe('cancelling a party', () => {
    it('emails the parent, copying the studio and its franchise owner', async () => {
        mocks.getBooking.mockResolvedValue(booking('werribee'))

        await cancel('werribee')

        expect(mocks.deleteBooking).toHaveBeenCalledWith('b1')
        const [[, to, values, options]] = emailsSent('partyBookingCancellation')
        expect(to).toBe('jane@example.com')
        expect(values.childName).toBe('Max')
        expect(options.bcc).toEqual(['werribee@fizzkidz.com.au', 'paris.c@fizzkidz.com.au'])
    })

    it('cancels the cake and lolly bags with the supplier at a supplier studio', async () => {
        mocks.getBooking.mockResolvedValue(booking('malvern', { cake, takeHomeBags: { lollyBags: 12 } }))

        await cancel('malvern')

        const [[, to, values, options]] = emailsSent('partySupplierOrderChange')
        expect(to).toBe('orders@birthdaycakeshop.com.au')
        expect(values.heading).toBe('Order cancelled')
        expect(values.previousStudio).toBeUndefined()
        expect(values.cake.selection).toBe('Unicorn')
        expect(values.takeHomeBags).toEqual([{ name: 'Lolly Bags', quantity: '12' }])
        expect(options.bcc).toEqual(['malvern@fizzkidz.com.au'])
        expect(mocks.release).not.toHaveBeenCalled()
    })

    it("doesn't email the supplier when nothing was ordered", async () => {
        mocks.getBooking.mockResolvedValue(booking('malvern'))
        await cancel('malvern')
        expect(emailsSent('partySupplierOrderChange')).toHaveLength(0)
    })

    it('gives the stock back at a stocked studio instead of emailing the supplier', async () => {
        mocks.getBooking.mockResolvedValue(booking('geelong', { cake }))

        await cancel('geelong')

        expect(mocks.release).toHaveBeenCalledWith({ location: 'geelong', bookingId: 'b1' })
        expect(emailsSent('partySupplierOrderChange')).toHaveLength(0)
    })

    it('still cancels the party when an email fails', async () => {
        mocks.getBooking.mockResolvedValue(booking('malvern', { cake }))
        mocks.sendEmail.mockRejectedValue(new Error('sendgrid down'))

        await cancel('malvern')

        expect(mocks.deleteBooking).toHaveBeenCalledWith('b1')
        expect(mocks.logError).toHaveBeenCalledTimes(2)
    })
})
