import { describe, expect, it } from 'vite-plus/test'

import type { PartyForm } from '@fizz-kidz/core'

import { getPartyFormBookingCake, getPartyFormBookingUpdate } from '../get-party-form-booking-update'

const partyForm: PartyForm = {
    mode: 'party',
    bookingId: 'booking',
    parentFirstName: 'Alex',
    parentLastName: 'Smith',
    childName: 'Charlie',
    childAge: '7',
    numberOfChildren: '12',
    additions: [],
    creations: [
        { packageKey: 'slime', creationKeys: ['fluffySlime'] },
        { packageKey: 'glam', creationKeys: ['lipBalm'] },
    ],
    takeHomeBags: { lollyBags: 12, lollyToyMixBags: 0 },
    products: {},
}

describe('party form booking update', () => {
    it('maps the party answers to booking fields', () => {
        expect(getPartyFormBookingUpdate(partyForm, { type: 'mobile' })).toEqual({
            parentFirstName: 'Alex',
            parentLastName: 'Smith',
            childName: 'Charlie',
            childAge: '7',
            numberOfChildren: '12',
            creation1: 'fluffySlime',
            creation2: 'lipBalm',
            creation3: undefined,
            funFacts: '',
            questions: '',
            partyFormFilledIn: true,
            takeHomeBags: { lollyBags: 12 },
            products: {},
        })
    })
    it('sets the food package and chosen additions for studio parties', () => {
        expect(
            getPartyFormBookingUpdate(
                { ...partyForm, foodPackage: 'self-cater', additions: ['wedges', 'fairyBread'] },
                { type: 'studio' }
            )
        ).toMatchObject({ includesFood: false, wedges: true, fairyBread: true })
    })
    it('only sets the order for the cake form', () => {
        const cake = { selection: 'Rainbow', size: 'Small', flavours: ['Mango'], served: 'Cup', candles: 'None' }
        expect(
            getPartyFormBookingUpdate(
                { mode: 'cake', bookingId: 'booking', cake, takeHomeBags: {}, products: { bathBombKit: 12 } },
                { type: 'studio' }
            )
        ).toEqual({ cake, takeHomeBags: {}, products: { bathBombKit: 12 } })
        expect(getPartyFormBookingCake({ ...partyForm, cake: { ...cake, message: 'Happy 7th' } })).toEqual({
            ...cake,
            message: 'Happy 7th',
        })
    })
})
