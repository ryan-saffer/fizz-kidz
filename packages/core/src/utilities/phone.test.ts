import { describe, expect, it } from 'vitest'

import { toE164AustralianPhone } from './phone'

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
