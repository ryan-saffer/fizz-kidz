import { strictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import { getCakeFormUrl, getPartyFormUrl } from './party-form-urls'

describe('party form URLs', () => {
    it('builds the hosted party form URL', () => {
        const url = new URL(getPartyFormUrl('party booking/id'))

        strictEqual(url.pathname, '/forms/party')
        strictEqual(url.searchParams.get('id'), 'party booking/id')
    })

    it('builds the hosted cake form URL using the requested environment', () => {
        const emulatorUrl = new URL(getCakeFormUrl('cake booking/id', true))
        const hostedUrl = new URL(getCakeFormUrl('cake booking/id', false))
        const defaultUrl = new URL(getCakeFormUrl('default cake booking'))

        strictEqual(emulatorUrl.origin, 'http://localhost:3000')
        strictEqual(emulatorUrl.pathname, '/forms/cake')
        strictEqual(emulatorUrl.searchParams.get('id'), 'cake booking/id')
        strictEqual(hostedUrl.pathname, '/forms/cake')
        strictEqual(hostedUrl.searchParams.get('id'), 'cake booking/id')
        strictEqual(defaultUrl.pathname, '/forms/cake')
        strictEqual(defaultUrl.searchParams.get('id'), 'default cake booking')
    })
})
