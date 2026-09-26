import { DateTime } from 'luxon'
import { describe, expect, it } from 'vite-plus/test'

import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import {
    getAgeTurning,
    getExistingBookingValues,
    getNewBookingValues,
    getPartyBookingPrefill,
    toNewBooking,
    toUpdatedBooking,
} from '../party-booking-form'

const timestamp = (iso: string) => ({ toDate: () => new Date(iso) }) as FirestoreBooking['dateTime']

const existingBooking = {
    id: 'booking-1',
    eventId: 'event-1',
    parentFirstName: 'Jane',
    parentLastName: 'Smith',
    parentEmail: 'jane@example.com',
    parentMobile: '+61 412 345 678',
    childName: 'Mia',
    childAge: '6',
    location: 'balwyn',
    type: 'studio',
    partyLength: '1.5',
    address: '',
    numberOfChildren: '12',
    notes: 'Allergic to nuts',
    creation1: 'slime',
    creation2: 'retired-creation',
    creation3: undefined,
    menu: undefined,
    cakeFlavour: undefined,
    questions: '',
    funFacts: 'Loves unicorns',
    partyFormFilledIn: true,
    sendConfirmationEmail: true,
    oldPrices: false,
    includesFood: true,
    chickenNuggets: true,
    potatoGems: true, // retired addition
    cake: { selection: 'Rainbow', size: 'Small', flavours: ['Vanilla'], served: 'Cups', candles: 'Yes' },
    useRsvpSystem: true,
    invitationId: 'invite-1',
    invitationOwnerUid: 'uid-1',
    // 10am Saturday in Melbourne (AEST, UTC+10) in July
    dateTime: timestamp('2026-07-11T00:00:00.000Z'),
} as unknown as WithId<FirestoreBooking>

describe('party booking form values', () => {
    it('reads an existing booking in Melbourne time', () => {
        const values = getExistingBookingValues(existingBooking)
        expect(values.date).toBe('2026-07-11')
        expect(values.time).toBe('10:00')
        expect(values.creations).toEqual(['slime', 'retired-creation', ''])
        expect(values.additions).toEqual(expect.arrayContaining(['chickenNuggets', 'potatoGems']))
        expect(values.foodPackage).toBe('include')
    })

    it('saves edits over the existing booking, keeping what the form does not show', () => {
        const values = {
            ...getExistingBookingValues(existingBooking),
            time: '11:30',
            creations: ['slime', '', ''] as [string, string, string],
            additions: ['fairyBread' as const],
            notes: '  Allergic to nuts and eggs  ',
        }

        const booking = toUpdatedBooking(values, existingBooking)

        expect(booking).not.toHaveProperty('id')
        expect(booking.eventId).toBe('event-1')
        expect(booking.cake).toEqual(existingBooking.cake)
        expect(booking.invitationId).toBe('invite-1')
        expect(booking.dateTime.toISOString()).toBe('2026-07-11T01:30:00.000Z')
        expect(booking.creation2).toBe('')
        expect(booking.fairyBread).toBe(true)
        expect(booking.chickenNuggets).toBe(false)
        expect(booking.potatoGems).toBe(false)
        expect(booking.notes).toBe('Allergic to nuts and eggs')
    })

    it('builds a new booking from its children, in Melbourne time', () => {
        const booking = toNewBooking({
            ...getNewBookingValues(),
            parentFirstName: ' Jane ',
            parentLastName: 'Smith',
            parentEmail: 'jane@example.com',
            parentMobile: '0412345678',
            children: [
                { name: 'Mia', birthday: '2020-05-01', age: '6' },
                { name: 'Leo ', birthday: '2022-02-02', age: '4' },
            ],
            date: '2026-10-10',
            time: '10:00',
            type: 'studio',
            location: 'balwyn',
            partyLength: '2',
            address: 'left over from mobile',
            foodPackage: 'self-cater',
        })

        expect(booking.parentFirstName).toBe('Jane')
        expect(booking.childName).toBe('Mia & Leo')
        expect(booking.childAge).toBe('6 & 4')
        expect(booking.children).toEqual([
            { name: 'Mia', age: '6', birthday: '2020-05-01' },
            { name: 'Leo', age: '4', birthday: '2022-02-02' },
        ])
        // 10am during daylight saving (AEDT, UTC+11)
        expect(booking.dateTime.toISOString()).toBe('2026-10-09T23:00:00.000Z')
        expect(booking.address).toBe('')
        expect(booking.includesFood).toBe(false)
        expect(booking.useRsvpSystem).toBe(true)
    })

    it('works out the age a child is turning', () => {
        const today = DateTime.fromISO('2026-09-26', { zone: 'Australia/Melbourne' })
        expect(getAgeTurning('2020-10-01', today)).toBe('6')
        expect(getAgeTurning('2020-09-26', today)).toBe('7')
        expect(getAgeTurning('2027-01-01', today)).toBe('')
    })

    it('reads a CRM prefill link', () => {
        const prefill = getPartyBookingPrefill(
            new URLSearchParams('parentName=Jane%20Mary%20Smith&type=At%20Home&location=Balwyn&zohoDealId=123')
        )
        expect(prefill).toEqual({
            parentFirstName: 'Jane',
            parentLastName: 'Mary Smith',
            type: 'mobile',
            location: 'balwyn',
            zohoDealId: '123',
        })
        expect(getPartyBookingPrefill(new URLSearchParams('location=nowhere'))).toBeNull()
    })
})
