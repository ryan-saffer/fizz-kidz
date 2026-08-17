import { strictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import { getApplicationDomain } from './application-domain'

describe('getApplicationDomain', () => {
    it('returns the local Portal when using the emulator', () => {
        strictEqual(getApplicationDomain('prod', true), 'http://localhost:3000')
    })

    it('returns the production domain', () => {
        strictEqual(getApplicationDomain('prod', false), 'https://bookings.fizzkidz.com.au')
    })

    it('returns the development domain', () => {
        strictEqual(getApplicationDomain('dev', false), 'https://dev.fizzkidz.com.au')
    })
})
