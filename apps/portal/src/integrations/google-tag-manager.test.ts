import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pushBookingConversion, toE164AustralianPhone } from './google-tag-manager'

describe('toE164AustralianPhone', () => {
    it.each([
        ['0412 345 678', '+61412345678'],
        ['(03) 9059 8144', '+61390598144'],
        ['+61 412 345 678', '+61412345678'],
        ['61412345678', '+61412345678'],
        ['412345678', '+61412345678'],
    ])('formats %s as %s', (input, expected) => {
        expect(toE164AustralianPhone(input)).toBe(expected)
    })

    it('returns undefined when there are no digits', () => {
        expect(toE164AustralianPhone(' ')).toBeUndefined()
    })
})

describe('pushBookingConversion', () => {
    beforeEach(() => {
        vi.stubGlobal('window', {})
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('pushes the event GTM listens for, with enhanced conversion data', () => {
        pushBookingConversion({
            event: 'preschool_program_booking',
            transactionId: 'abc-123',
            value: 117,
            currency: 'AUD',
            studio: 'essendon',
            parentEmail: ' Parent@Example.com ',
            parentPhone: '0412 345 678',
        })

        expect(window.dataLayer).toEqual([
            {
                event: 'preschool_program_booking',
                value: 117,
                currency: 'AUD',
                transaction_id: 'abc-123',
                studio: 'essendon',
                user_data: { email: 'parent@example.com', phone_number: '+61412345678' },
            },
        ])
    })
})
