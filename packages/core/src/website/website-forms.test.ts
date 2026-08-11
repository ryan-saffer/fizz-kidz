import { deepStrictEqual, strictEqual } from 'node:assert'

import { describe, it } from 'vite-plus/test'

import {
    CareersWebsiteFormSchema,
    ContactWebsiteFormSchema,
    PartyWebsiteFormSchema,
    WebsiteFormIdSchema,
    WebsiteFormSchemas,
} from './website-forms'

describe('website form contracts', () => {
    it('keeps the accepted form ids in sync with the schema map', () => {
        deepStrictEqual(WebsiteFormIdSchema.options, Object.keys(WebsiteFormSchemas))
    })

    it('accepts a valid party enquiry', () => {
        const result = PartyWebsiteFormSchema.safeParse({
            name: 'Fizz Parent',
            email: 'parent@example.com',
            contactNumber: '0400000000',
            location: 'werribee',
            preferredDateAndTime: 'Saturday afternoon',
            partyTheme: 'slime',
            enquiry: 'Please send package information',
            reference: 'google',
        })

        strictEqual(result.success, true)
    })

    it('requires a suburb for an at-home party', () => {
        const result = PartyWebsiteFormSchema.safeParse({
            name: 'Fizz Parent',
            email: 'parent@example.com',
            contactNumber: '0400000000',
            location: 'at-home',
            preferredDateAndTime: 'Saturday afternoon',
            partyTheme: 'slime',
            enquiry: 'Please send package information',
            reference: 'google',
        })

        strictEqual(result.success, false)
        if (!result.success) deepStrictEqual(result.error.issues[0].path, ['suburb'])
    })

    it('applies service-specific contact form requirements', () => {
        const result = ContactWebsiteFormSchema.safeParse({
            name: 'Fizz Teacher',
            email: 'teacher@example.com',
            contactNumber: '0400000000',
            service: 'incursion',
            enquiry: 'Please send incursion information',
        })

        strictEqual(result.success, false)
        if (!result.success) {
            deepStrictEqual(
                result.error.issues.map(({ path }) => path[0]),
                ['school', 'preferredDateAndTime', 'module', 'numberOfSessions', 'numberOfStudentsPerSession']
            )
        }
    })

    it('accepts Werribee for a location-specific contact enquiry', () => {
        const result = ContactWebsiteFormSchema.safeParse({
            name: 'Fizz Parent',
            email: 'parent@example.com',
            contactNumber: '0400000000',
            service: 'holiday-program',
            location: 'werribee',
            enquiry: 'Please send program information',
            reference: 'google',
        })

        strictEqual(result.success, true)
    })

    it('validates the uploaded resume as part of a careers submission', () => {
        const result = CareersWebsiteFormSchema.safeParse({
            name: 'Fizz Applicant',
            email: 'applicant@example.com',
            contactNumber: '0400000000',
            role: 'facilitator',
            location: 'werribee',
            wwcc: 'yes',
            driversLicense: 'yes',
            application: 'I enjoy working with children.',
            reference: 'Instagram',
            resume: { name: 'resume.pdf', url: 'not-a-url' },
        })

        strictEqual(result.success, false)
        if (!result.success) deepStrictEqual(result.error.issues[0].path, ['resume', 'url'])
    })
})
