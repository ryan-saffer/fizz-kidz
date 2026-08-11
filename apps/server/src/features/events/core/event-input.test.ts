import { deepStrictEqual, strictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import { splitContactName, trimEventTextFields } from './event-input'

describe('event input', () => {
    it('trims every string field without changing non-string values', () => {
        const event = {
            contactName: '  Stefanie  ',
            notes: '\n Details about the event \n',
            numberOfAttendees: ' 25 ',
            optionalValue: undefined,
            priceInCents: 100,
        }

        const result = trimEventTextFields(event)

        deepStrictEqual(result, {
            contactName: 'Stefanie',
            notes: 'Details about the event',
            numberOfAttendees: '25',
            optionalValue: undefined,
            priceInCents: 100,
        })
        strictEqual(event.contactName, '  Stefanie  ')
    })

    it('splits a contact name despite leading or repeated whitespace', () => {
        deepStrictEqual(splitContactName('  Stefanie   Anne  Smith  '), {
            firstName: 'Stefanie',
            lastName: 'Anne Smith',
        })
    })
})
