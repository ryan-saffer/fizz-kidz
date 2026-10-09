import { describe, expect, it } from 'vite-plus/test'

import { getNewBookingValues, type PartyBookingFormValues } from '../party-booking-form'
import { getPartyBookingSchema } from '../party-booking-schema'

const validNewBooking: PartyBookingFormValues = {
    ...getNewBookingValues(),
    parentFirstName: 'Jane',
    parentLastName: 'Smith',
    parentEmail: 'jane@example.com',
    parentMobile: '0412345678',
    children: [{ name: 'Mia', birthday: '2020-05-01', age: '6' }],
    date: '2026-10-10',
    time: '10:00',
    type: 'studio',
    location: 'balwyn',
    partyLength: '1.5',
    foodPackage: 'include',
}

function errorsFor(values: PartyBookingFormValues, mode: 'create' | 'edit' = 'create') {
    const result = getPartyBookingSchema(mode).safeParse(values)
    return result.success
        ? {}
        : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}

describe('party booking schema', () => {
    it('accepts a complete new booking', () => {
        expect(errorsFor(validNewBooking)).toEqual({})
    })

    it('reports every missing answer on an empty booking at once', () => {
        const errors = errorsFor(getNewBookingValues())
        expect(Object.keys(errors).sort()).toEqual(
            [
                'children.0.age',
                'children.0.birthday',
                'children.0.name',
                'date',
                'location',
                'parentEmail',
                'parentFirstName',
                'parentLastName',
                'parentMobile',
                'partyLength',
                'time',
                'type',
            ].sort()
        )
    })

    it('checks the email and mobile formats', () => {
        const errors = errorsFor({ ...validNewBooking, parentEmail: 'jane@', parentMobile: '0412 345' })
        expect(errors.parentEmail).toBe('Enter a valid email address')
        expect(errors.parentMobile).toBe('Mobile number must be 10 digits')
    })

    it('rejects party lengths the party type does not offer', () => {
        expect(errorsFor({ ...validNewBooking, partyLength: '1' }).partyLength).toBe('Studio parties can’t be 1 hour')
        expect(
            errorsFor({ ...validNewBooking, type: 'mobile', partyLength: '2', address: '1 Main St', foodPackage: '' })
                .partyLength
        ).toBe('Mobile parties can’t be 2 hours')
    })

    it('needs an address for mobile parties and a food package for studio parties', () => {
        expect(errorsFor({ ...validNewBooking, type: 'mobile', partyLength: '1', foodPackage: '' })).toEqual({
            address: 'Enter the party address',
        })
        expect(errorsFor({ ...validNewBooking, foodPackage: '' })).toEqual({ foodPackage: 'Choose a food package' })
    })

    it('checks party type rules while other answers are still missing', () => {
        const errors = errorsFor({ ...getNewBookingValues(), type: 'mobile' })
        expect(errors.address).toBe('Enter the party address')
    })

    it('lets an existing booking keep an older mobile format and checks its child name and age', () => {
        const existing = {
            ...validNewBooking,
            children: [],
            parentMobile: '+61 412 345 678',
            childName: 'Mia',
            childAge: '',
        }
        expect(errorsFor(existing, 'edit')).toEqual({ childAge: 'Enter the child’s age' })
    })
})
