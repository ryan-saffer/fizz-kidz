import { strictEqual } from 'assert'

import MockDate from 'mockdate'
import { afterEach, describe, it } from 'vite-plus/test'

import { getUpcoming } from './party-form-scheduling'

describe('party form scheduling', () => {
    afterEach(() => MockDate.reset())

    it('returns the next occurrence of each weekday at Melbourne midnight', () => {
        MockDate.set('2024-07-03T02:00:00.000Z') // Wednesday, 12pm AEST

        strictEqual(
            getUpcoming('Tuesday').toLocaleString('en-au', { timeZone: 'Australia/Melbourne' }),
            '09/07/2024, 12:00:00 am'
        )
        strictEqual(
            getUpcoming('Wednesday').toLocaleString('en-au', { timeZone: 'Australia/Melbourne' }),
            '10/07/2024, 12:00:00 am'
        )
        strictEqual(
            getUpcoming('Thursday').toLocaleString('en-au', { timeZone: 'Australia/Melbourne' }),
            '04/07/2024, 12:00:00 am'
        )
    })
})
