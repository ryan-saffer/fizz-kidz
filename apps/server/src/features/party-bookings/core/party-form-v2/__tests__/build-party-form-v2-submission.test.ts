import { describe, expect, it, vi } from 'vite-plus/test'

import type { BirthdayPartyBookingCatalogue, PartyFormV2 } from '@fizz-kidz/core'

import { PartyFormMapper } from '../../party-form-mapper'
import { buildPartyFormV2Submission, partyFormV2BookingCake } from '../build-party-form-v2-submission'

vi.mock('firebase-functions/v2', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

const bookingCatalogue: BirthdayPartyBookingCatalogue = {
    creations: [
        {
            key: 'fairySlime',
            bookingChannels: ['studio', 'mobile'],
            legacyLabels: ['Fairy Glitter Slime'],
            name: 'Fairy Slime',
            status: 'active',
        },
        {
            key: 'monsterSlime',
            bookingChannels: ['studio', 'mobile'],
            legacyLabels: [],
            name: 'Monster Slime',
            status: 'active',
        },
    ],
    packages: [
        {
            creations: [
                {
                    key: 'fairySlime',
                },
            ],
            key: 'fairy',
            name: 'Fairy',
            position: 1,
            status: 'active',
        },
        {
            creations: [
                {
                    key: 'monsterSlime',
                },
            ],
            key: 'science',
            name: 'Science',
            position: 2,
            status: 'active',
        },
    ],
}

const basePayload: PartyFormV2 = {
    mode: 'party',
    bookingId: 'booking-id',
    parentFirstName: 'Jane',
    parentLastName: 'Smith',
    childName: 'Alex',
    childAge: '7',
    numberOfChildren: '16 - 20',
    creations: [
        { packageKey: 'fairy', creationKeys: ['fairySlime'] },
        { packageKey: 'science', creationKeys: ['monsterSlime'] },
    ],
    foodPackage: 'include',
    additions: ['fairyBread'],
    cake: {
        selection: 'Rainbow Ice-Cream Cake',
        size: 'Medium (15-25 serves)',
        flavours: ['Vanilla', 'Chocolate'],
        served: 'Ice-cream cup with spoon',
        candles: 'Include candles',
        message: 'Happy Birthday!',
    },
    takeHomeBags: { lollyBags: 16 },
    products: { bathBombKit: 2 },
    funFacts: 'Loves dinosaurs',
    questions: 'Can we arrive early?',
}

const bookingDetails = {
    type: 'studio' as const,
    location: 'malvern' as const,
    parentFirstName: 'Jane',
    parentLastName: 'Citizen',
    childName: 'Mia',
    childAge: '7',
    includesFood: true,
}

describe('buildPartyFormV2Submission', () => {
    it('produces a submission the existing PartyFormMapper maps like a Paperform one', () => {
        const submission = buildPartyFormV2Submission(basePayload, { ...bookingDetails, type: 'studio' }, 'v2-abc')

        expect(submission.getSubmissionId()).toBe('v2-abc')
        expect(submission.getFieldValue('party_or_cake_form')).toBe('party')

        const booking = new PartyFormMapper(submission, bookingCatalogue).mapToBooking('studio', 'malvern')

        expect(booking.location).toBe('malvern')
        expect(booking.parentFirstName).toBe('Jane')
        expect(booking.numberOfChildren).toBe('16 - 20')
        // creations are ordered by the Paperform field order (science before fairy), matching the live form
        expect(booking.creation1).toBe('monsterSlime')
        expect(booking.creation2).toBe('fairySlime')
        expect(booking.creation3).toBe(undefined)
        expect(booking.includesFood).toBe(true)
        expect(booking.fairyBread).toBe(true)
        // Square cake names can't go through the Paperform cake fields; processing passes the cake directly
        expect(booking.cake).toBe(undefined)
        expect(partyFormV2BookingCake(basePayload)).toEqual({
            selection: 'Rainbow Ice-Cream Cake',
            flavours: ['Vanilla', 'Chocolate'],
            size: 'Medium (15-25 serves)',
            served: 'Ice-cream cup with spoon',
            candles: 'Include candles',
            message: 'Happy Birthday!',
        })
        expect(booking.takeHomeBags).toEqual({ lollyBags: 16 })
        expect(booking.products).toEqual({ bathBombKit: 2 })
        expect(booking.funFacts).toBe('Loves dinosaurs')
        expect(booking.questions).toBe('Can we arrive early?')
    })

    it('maps a mobile payload without a cake through the mobile fields', () => {
        const payload: PartyFormV2 = {
            ...basePayload,
            mode: 'party',
            numberOfChildren: '14',
            foodPackage: undefined,
            additions: [],
            cake: undefined,
            takeHomeBags: {},
            products: {},
        }
        const submission = buildPartyFormV2Submission(payload, { ...bookingDetails, type: 'mobile' }, 'v2-def')

        expect(submission.getFieldValue('fairy_creations_mobile')).toEqual(['fairySlime'])
        expect(submission.getFieldValue('fairy_creations')).toEqual(undefined)

        const booking = new PartyFormMapper(submission, bookingCatalogue).mapToBooking('mobile', 'malvern')

        expect(booking.numberOfChildren).toBe('14')
        expect(booking.creation1).toBe('monsterSlime')
        expect(booking.creation2).toBe('fairySlime')
        expect(booking.cake).toBe(undefined)
        expect(booking.includesFood).toBe(undefined)
        expect(booking.takeHomeBags).toEqual({})
        expect(booking.products).toEqual({})
    })

    it('maps a cake form order without touching the party answers the booking already holds', () => {
        const payload: PartyFormV2 = {
            mode: 'cake',
            bookingId: 'booking-1',
            takeHomeBags: { lollyBags: 12 },
            products: {},
        }
        const submission = buildPartyFormV2Submission(payload, bookingDetails, 'v2-cake')

        expect(submission.getFieldValue('party_or_cake_form')).toBe('cake')
        expect(submission.getFieldValue('parent_first_name')).toBe('Jane')
        expect(submission.getFieldValue('food_package')).toBe('Include the food package')

        const mapped = new PartyFormMapper(submission, bookingCatalogue).mapToBooking('studio', 'malvern')
        expect(mapped.takeHomeBags).toEqual({ lollyBags: 12 })
        expect(mapped.includesFood).toBe(true)
        // unanswered party questions stay undefined, so writing the booking keeps its existing values
        expect(mapped.creation1).toBe(undefined)
        expect(mapped.funFacts).toBe(undefined)
        expect(mapped.numberOfChildren).toBe(undefined)
        expect(mapped.cake).toBe(undefined)
    })
})
