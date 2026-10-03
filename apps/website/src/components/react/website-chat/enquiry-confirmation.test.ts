import { describe, expect, it } from 'vite-plus/test'

import { getEnquiryDetails } from './enquiry-confirmation'

describe('getEnquiryDetails', () => {
    it('shows what the customer gave, in their terms, without the note for the team', () => {
        expect(
            getEnquiryDetails({
                name: 'Khyati Patel',
                email: 'khyati@example.com',
                contactNumber: '0400111222',
                service: 'party',
                location: 'balwyn',
                preferredDateAndTime: 'Saturday 10 October, 10am',
                partyTheme: 'slime',
                enquiry: 'Asked about lolly bags.',
            })
        ).toEqual([
            { label: 'Enquiry', value: 'Birthday Party' },
            { label: 'Name', value: 'Khyati Patel' },
            { label: 'Email', value: 'khyati@example.com' },
            { label: 'Mobile', value: '0400111222' },
            { label: 'Date and time', value: 'Saturday 10 October, 10am' },
            { label: 'Where', value: 'Balwyn' },
            { label: 'Theme', value: 'Slime Party' },
        ])
    })

    it('describes a party at their place with the suburb', () => {
        expect(getEnquiryDetails({ location: 'at-home', suburb: 'Reservoir' })).toEqual([
            { label: 'Where', value: 'At your place, Reservoir' },
        ])
    })
})
