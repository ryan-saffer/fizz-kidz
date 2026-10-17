import { describe, expect, it } from 'vitest'

import { getStudioNotificationEmails } from './contact-info'

describe('who hears about changes to a studio’s parties', () => {
    it('is the studio inbox and its owner for a franchise', () => {
        expect(getStudioNotificationEmails('werribee')).toEqual(['werribee@fizzkidz.com.au', 'paris.c@fizzkidz.com.au'])
        expect(getStudioNotificationEmails('balwyn')).toEqual(['balwyn@fizzkidz.com.au', 'swetha.d@fizzkidz.com.au'])
        expect(getStudioNotificationEmails('kingsville')).toEqual([
            'kingsville@fizzkidz.com.au',
            'kate.p@fizzkidz.com.au',
        ])
    })

    it('is just the studio inbox for a corporate studio', () => {
        expect(getStudioNotificationEmails('geelong')).toEqual(['geelong@fizzkidz.com.au'])
    })

    it('is only the dev inbox in dev', () => {
        expect(getStudioNotificationEmails('werribee', 'dev')).toEqual(['ryan@fizzkidz.com.au'])
    })
})
