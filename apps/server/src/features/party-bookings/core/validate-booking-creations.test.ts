import { deepStrictEqual } from 'node:assert'

import { describe, it } from 'vite-plus/test'

import type { BirthdayPartyBookingCatalogue, Booking } from '@fizz-kidz/core'

import { getInvalidBookingCreationKeys } from './validate-booking-creations'

const catalogue: BirthdayPartyBookingCatalogue = {
    creations: [
        {
            bookingChannels: ['studio', 'mobile'],
            key: 'fairySlime',
            legacyLabels: [],
            name: 'Fairy Slime',
            status: 'active',
        },
        {
            bookingChannels: ['studio'],
            key: 'unicornSoap',
            legacyLabels: [],
            name: 'Unicorn Soap',
            status: 'active',
        },
        { bookingChannels: [], key: 'oldSlime', legacyLabels: [], name: 'Old Slime', status: 'retired' },
    ],
    packages: [
        {
            creations: [
                {
                    bookingOrder: 1,
                    key: 'fairySlime',
                },
                {
                    bookingOrder: 2,
                    key: 'unicornSoap',
                },
            ],
            key: 'fairy',
            name: 'Fairy',
            position: 1,
            status: 'active',
        },
    ],
}

function booking(type: Booking['type'], creation1?: string) {
    return { creation1, creation2: undefined, creation3: undefined, type }
}

describe('getInvalidBookingCreationKeys', () => {
    it('accepts active creations available for the booking channel', () => {
        deepStrictEqual(getInvalidBookingCreationKeys(catalogue, booking('mobile', 'fairySlime')), [])
    })

    it('rejects creations unavailable for the booking channel', () => {
        deepStrictEqual(getInvalidBookingCreationKeys(catalogue, booking('mobile', 'unicornSoap')), ['unicornSoap'])
    })

    it('preserves a previously selected retired or unknown creation', () => {
        deepStrictEqual(
            getInvalidBookingCreationKeys(catalogue, booking('studio', 'oldSlime'), booking('studio', 'oldSlime')),
            []
        )
        deepStrictEqual(
            getInvalidBookingCreationKeys(
                catalogue,
                booking('studio', 'historicalKey'),
                booking('studio', 'historicalKey')
            ),
            []
        )
    })

    it('revalidates existing selections when the party channel changes', () => {
        deepStrictEqual(
            getInvalidBookingCreationKeys(
                catalogue,
                booking('mobile', 'unicornSoap'),
                booking('studio', 'unicornSoap')
            ),
            ['unicornSoap']
        )
    })

    it('does not allow one historical selection to be duplicated into another slot', () => {
        deepStrictEqual(
            getInvalidBookingCreationKeys(
                catalogue,
                {
                    creation1: 'oldSlime',
                    creation2: 'oldSlime',
                    creation3: undefined,
                    type: 'studio',
                },
                booking('studio', 'oldSlime')
            ),
            ['oldSlime']
        )
    })

    it('rejects a newly selected retired or unknown creation', () => {
        deepStrictEqual(getInvalidBookingCreationKeys(catalogue, booking('studio', 'oldSlime')), ['oldSlime'])
        deepStrictEqual(getInvalidBookingCreationKeys(catalogue, booking('studio', 'missingKey')), ['missingKey'])
    })
})
