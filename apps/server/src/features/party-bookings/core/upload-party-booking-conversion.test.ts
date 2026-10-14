import { createHash } from 'crypto'

import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'

import { buildPartyBookingConversion, estimatePartyValue, normaliseEmail } from './upload-party-booking-conversion'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

const booking = {
    parentEmail: ' Jane.Citizen@Gmail.com ',
    parentMobile: '0412 345 678',
    location: 'kingsville' as const,
    type: 'studio' as const,
    partyLength: '1.5' as const,
    numberOfChildren: '15',
}

describe('estimatePartyValue', () => {
    it.each([
        [{ type: 'studio', partyLength: '1.5', numberOfChildren: '12' }, 480],
        [{ type: 'studio', partyLength: '2', numberOfChildren: '14' }, 636 + 2 * 53],
        [{ type: 'mobile', partyLength: '1', numberOfChildren: '10' }, 468],
        [{ type: 'mobile', partyLength: '1.5', numberOfChildren: '' }, 564],
    ] as const)('estimates %o as $%i', (details, expected) => {
        expect(estimatePartyValue({ ...booking, ...details })).toBe(expected)
    })
})

describe('normaliseEmail', () => {
    it('removes dots from Gmail usernames only', () => {
        expect(normaliseEmail(' Jane.Citizen@Gmail.com ')).toBe('janecitizen@gmail.com')
        expect(normaliseEmail('Jane.Citizen@fizzkidz.com.au')).toBe('jane.citizen@fizzkidz.com.au')
    })
})

describe('buildPartyBookingConversion', () => {
    it('hashes the parent contact details, dates the booking in Melbourne time and tags the studio', () => {
        const conversion = buildPartyBookingConversion('booking-1', booking, DateTime.fromISO('2026-10-13T05:00:00Z'))

        expect(conversion).toEqual({
            transactionId: 'booking-1',
            eventTimestamp: '2026-10-13T16:00:00+11:00',
            conversionValue: 480 + 3 * 40,
            currency: 'AUD',
            customVariables: [{ variable: '28986586', value: 'kingsville' }],
            userIdentifiers: [
                { emailAddress: sha256('janecitizen@gmail.com') },
                { phoneNumber: sha256('+61412345678') },
            ],
        })
    })
})
