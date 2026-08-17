import { deepStrictEqual, strictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import { STUDIOS, type Studio } from '../core/studio'
import {
    canOrderCake,
    getBookingAdditionDisplayValues,
    getBookingCreationDisplayValues,
    getPartyChildCapacityMessages,
    getPartyCreationCount,
    getPartyEndDate,
    isPartyAdditionKey,
} from './party.utils'

import type { BaseBooking, Booking } from './booking'

describe('party utilities', () => {
    describe('getBookingCreationDisplayValues', () => {
        it('returns selected creation display values in booking order', () => {
            const booking = {
                creation1: 'sparklingLipBalm',
                creation2: 'jellySoap',
                creation3: 'fluffySlime',
            } as BaseBooking

            deepStrictEqual(getBookingCreationDisplayValues(booking), [
                'Sparkling Lip Balm',
                'Jelly Soap',
                'Fluffy Slime',
            ])
        })

        it('omits unselected creations', () => {
            const booking = {
                creation1: undefined,
                creation2: undefined,
                creation3: 'jellySoap',
            } as BaseBooking

            deepStrictEqual(getBookingCreationDisplayValues(booking), ['Jelly Soap'])
        })

        it('returns an empty list when no creations are selected', () => {
            const booking = {
                creation1: undefined,
                creation2: undefined,
                creation3: undefined,
            } as BaseBooking

            deepStrictEqual(getBookingCreationDisplayValues(booking), [])
        })
    })

    describe('getBookingAdditionDisplayValues', () => {
        it('returns display values for selected additions only', () => {
            const booking = {
                chickenNuggets: true,
                fairyBread: false,
                fruitPlatter: true,
                creation1: 'sparklingLipBalm',
            } as BaseBooking

            deepStrictEqual(getBookingAdditionDisplayValues(booking), ['Chicken Nuggets', 'Fruit Platter'])
        })
    })

    describe('isPartyAdditionKey', () => {
        it('identifies own addition keys only', () => {
            strictEqual(isPartyAdditionKey('chickenNuggets'), true)
            strictEqual(isPartyAdditionKey('creation1'), false)
            strictEqual(isPartyAdditionKey('toString'), false)
        })
    })

    describe('getPartyEndDate', () => {
        const start = new Date(2026, 7, 17, 10, 15)
        const cases: Array<[Booking['partyLength'], number, number]> = [
            ['1', 11, 15],
            ['1.5', 11, 45],
            ['2', 12, 15],
        ]

        for (const [partyLength, expectedHour, expectedMinute] of cases) {
            it(`adds a ${partyLength} hour party duration`, () => {
                const result = getPartyEndDate(start, partyLength)

                strictEqual(result.getHours(), expectedHour)
                strictEqual(result.getMinutes(), expectedMinute)
            })
        }
    })

    describe('getPartyCreationCount', () => {
        const cases: Array<[Booking['type'], Booking['partyLength'], 2 | 3]> = [
            ['studio', '1', 3],
            ['studio', '1.5', 2],
            ['studio', '2', 3],
            ['mobile', '1', 2],
            ['mobile', '1.5', 3],
            ['mobile', '2', 3],
        ]

        for (const [type, partyLength, expected] of cases) {
            it(`returns ${expected} for a ${partyLength} hour ${type} party`, () => {
                strictEqual(getPartyCreationCount({ type, partyLength }), expected)
            })
        }
    })

    describe('getPartyChildCapacityMessages', () => {
        it('returns Cheltenham capacities', () => {
            deepStrictEqual(getPartyChildCapacityMessages('cheltenham'), [
                '4 and 5 years old - max 20 kids',
                '6 years plus - max 26 kids',
            ])
        })

        it('returns standard capacities for other studios', () => {
            deepStrictEqual(getPartyChildCapacityMessages('balwyn'), [
                '4 and 5 years old - max 24 kids',
                '6 years plus - max 30 kids',
            ])
        })
    })

    describe('canOrderCake', () => {
        const excludedStudios: Studio[] = ['geelong', 'werribee']

        for (const studio of STUDIOS) {
            const expected = !excludedStudios.includes(studio)

            it(`returns ${expected} for a studio party at ${studio}`, () => {
                strictEqual(canOrderCake('studio', studio), expected)
            })
        }

        it('returns false for a mobile party at an otherwise eligible studio', () => {
            strictEqual(canOrderCake('mobile', 'balwyn'), false)
        })
    })
})
