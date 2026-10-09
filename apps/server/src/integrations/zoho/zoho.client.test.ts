import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ZohoClient } from './zoho.client'

vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: { getZohoAccessToken: async () => ({ accessToken: 'token', isRefreshing: false }) },
}))

type ZohoCall = { endpoint: string; data: Record<string, any>[] }

describe('ZohoClient parent with children', () => {
    let calls: ZohoCall[]

    beforeEach(() => {
        calls = []
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init: { body: string }) => {
                const endpoint = url.split('/crm/v6/')[1]
                const { data } = JSON.parse(init.body)
                calls.push({ endpoint, data })
                const id = endpoint.startsWith('Contacts') ? 'parent-1' : `child-${calls.length}`
                return new Response(JSON.stringify({ data: [{ code: 'SUCCESS', details: { id } }] }))
            })
        )
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const parent = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', mobile: '0400000000' }

    it('upserts the parent once and every child with the marketing opt-out', async () => {
        await new ZohoClient().addPreschoolProgramContact({
            ...parent,
            studio: 'malvern',
            children: [
                { childName: 'Mia', childBirthdayISO: '2021-05-01T00:00:00+10:00' },
                { childName: 'John', childBirthdayISO: '2022-08-12T00:00:00+10:00' },
            ],
            optOutOfMarketing: true,
        })

        const contactCalls = calls.filter((call) => call.endpoint === 'Contacts/upsert')
        const childCalls = calls.filter((call) => call.endpoint !== 'Contacts/upsert')

        expect(contactCalls).toHaveLength(1)
        expect(contactCalls[0].data[0]).toMatchObject({
            Email: 'jane@example.com',
            Service: ['Preschool Program'],
            Branch: ['Malvern'],
            Marketing_Campaign_Opt_Out: true,
        })
        expect(childCalls.map((call) => call.data[0])).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    Name: 'Mia',
                    Child_Birthday: '2021-05-01',
                    Parent: { id: 'parent-1' },
                    Marketing_Campaign_Opt_Out: true,
                }),
                expect.objectContaining({
                    Name: 'John',
                    Child_Birthday: '2022-08-12',
                    Parent: { id: 'parent-1' },
                    Marketing_Campaign_Opt_Out: true,
                }),
            ])
        )
        expect(childCalls).toHaveLength(2)
    })

    it('upserts the parent once for a party RSVP with several children', async () => {
        await new ZohoClient().addBirthdayPartyGuestContactWithChildren({
            ...parent,
            studio: 'balwyn',
            children: [
                { childName: 'Mia', childBirthdayISO: '2021-05-01T00:00:00+10:00' },
                { childName: 'John', childBirthdayISO: '2022-08-12T00:00:00+10:00' },
            ],
            optOutOfMarketing: false,
        })

        expect(calls.filter((call) => call.endpoint === 'Contacts/upsert')).toHaveLength(1)
        expect(calls.filter((call) => call.endpoint !== 'Contacts/upsert')).toHaveLength(2)
    })

    it('upserts children sharing a birthday once, so concurrent upserts do not race the duplicate check', async () => {
        await new ZohoClient().addPreschoolProgramContact({
            ...parent,
            studio: 'malvern',
            children: [
                { childName: 'Mia', childBirthdayISO: '2021-05-01T00:00:00+10:00' },
                { childName: 'Mia', childBirthdayISO: '2021-05-01T00:00:00+10:00' },
            ],
            optOutOfMarketing: false,
        })

        expect(calls.filter((call) => call.endpoint !== 'Contacts/upsert')).toHaveLength(1)
    })
})
