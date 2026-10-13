// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vite-plus/test'

import { pushLeadSubmit } from './lead-tracking'

describe('pushLeadSubmit', () => {
    beforeEach(() => {
        window.dataLayer = []
    })

    it('pushes lead_submit with enhanced conversion data', () => {
        pushLeadSubmit({ studio: 'werribee', email: ' Parent@Example.com ', contactNumber: '0412 345 678' })

        expect(window.dataLayer).toEqual([
            {
                event: 'lead_submit',
                studio: 'werribee',
                user_data: { email: 'parent@example.com', phone_number: '+61412345678' },
            },
        ])
    })

    it('leaves out a studio and contact details it was not given', () => {
        pushLeadSubmit({})

        expect(window.dataLayer).toEqual([{ event: 'lead_submit', user_data: {} }])
    })
})
