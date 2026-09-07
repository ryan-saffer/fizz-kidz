import { deepStrictEqual, strictEqual } from 'assert'

import { describe, it, vi } from 'vite-plus/test'

import type { BirthdayPartyBookingCatalogue, PartyFormV2 } from '@fizz-kidz/core'

import { PartyFormMapper } from '../party-form-mapper'
import { buildPartyFormV2Submission } from './build-party-form-v2-submission'

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
                    bookingOrder: 1,
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
                    bookingOrder: 1,
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
        size: 'medium_cake',
        flavours: ['Vanilla', 'Chocolate'],
        served: 'cup',
        candles: 'include_candles',
        message: 'Happy Birthday!',
    },
    takeHomeBags: { lollyBags: 16 },
    products: { bathBombKit: 2 },
    funFacts: 'Loves dinosaurs',
    questions: 'Can we arrive early?',
}

describe('buildPartyFormV2Submission', () => {
    it('produces a submission the existing PartyFormMapper maps like a Paperform one', () => {
        const submission = buildPartyFormV2Submission(basePayload, { type: 'studio', location: 'malvern' }, 'v2-abc')

        strictEqual(submission.getSubmissionId(), 'v2-abc')
        strictEqual(submission.getFieldValue('party_or_cake_form'), 'party')

        const booking = new PartyFormMapper(submission, bookingCatalogue).mapToBooking('studio', 'malvern')

        strictEqual(booking.location, 'malvern')
        strictEqual(booking.parentFirstName, 'Jane')
        strictEqual(booking.numberOfChildren, '16 - 20')
        // creations are ordered by the Paperform field order (science before fairy), matching the live form
        strictEqual(booking.creation1, 'monsterSlime')
        strictEqual(booking.creation2, 'fairySlime')
        strictEqual(booking.creation3, undefined)
        strictEqual(booking.includesFood, true)
        strictEqual(booking.fairyBread, true)
        deepStrictEqual(booking.cake, {
            selection: 'Rainbow Ice-Cream Cake',
            flavours: ['Vanilla', 'Chocolate'],
            size: 'Medium (20-25 serves)',
            served: 'Ice-cream cup with spoon',
            candles: 'Include candles',
            message: 'Happy Birthday!',
        })
        deepStrictEqual(booking.takeHomeBags, { lollyBags: 16 })
        deepStrictEqual(booking.products, { bathBombKit: 2 })
        strictEqual(booking.funFacts, 'Loves dinosaurs')
        strictEqual(booking.questions, 'Can we arrive early?')
    })

    it('maps a mobile payload without a cake through the mobile fields', () => {
        const payload: PartyFormV2 = {
            ...basePayload,
            numberOfChildren: '14',
            foodPackage: undefined,
            additions: [],
            cake: undefined,
            takeHomeBags: {},
            products: {},
        }
        const submission = buildPartyFormV2Submission(payload, { type: 'mobile', location: 'malvern' }, 'v2-def')

        deepStrictEqual(submission.getFieldValue('fairy_creations_mobile'), ['fairySlime'])
        deepStrictEqual(submission.getFieldValue('fairy_creations'), undefined)

        const booking = new PartyFormMapper(submission, bookingCatalogue).mapToBooking('mobile', 'malvern')

        strictEqual(booking.numberOfChildren, '14')
        strictEqual(booking.creation1, 'monsterSlime')
        strictEqual(booking.creation2, 'fairySlime')
        strictEqual(booking.cake, undefined)
        strictEqual(booking.includesFood, undefined)
        deepStrictEqual(booking.takeHomeBags, {})
        deepStrictEqual(booking.products, {})
    })
})
