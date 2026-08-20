import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, fetch } = vi.hoisted(() => ({
    createClient: vi.fn(),
    fetch: vi.fn(),
}))

vi.mock('@sanity/client', () => ({ createClient }))

import { SanityClient } from './sanity.client'

describe('SanityClient', () => {
    beforeEach(() => {
        fetch.mockReset()
        createClient.mockReturnValue({ fetch })
    })

    it('reads published Holiday Program instructions in date order', async () => {
        fetch.mockResolvedValue([{ _id: 'creation-1', date: '2026-09-21', name: 'Program', instructions: [] }])

        const sanity = await SanityClient.getInstance()
        const result = await sanity.getHolidayProgramCreations()

        expect(createClient).toHaveBeenCalledWith({
            projectId: 'rjsv3y4b',
            dataset: 'production',
            apiVersion: '2026-08-01',
            perspective: 'published',
            useCdn: true,
        })
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('| order(date asc)'))
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('"url": asset->url'))
        expect(result).toEqual([{ _id: 'creation-1', date: '2026-09-21', name: 'Program', instructions: [] }])
    })

    it('reads published Birthday Party packages and their ordered creations', async () => {
        const packages = [
            {
                _id: 'package-1',
                name: 'Slime Parties',
                colour: 'yellow',
                creations: [{ _id: 'creation-1', name: 'Fairy Slime', instructions: [] }],
            },
        ]
        fetch.mockResolvedValue(packages)

        const sanity = await SanityClient.getInstance()
        const result = await sanity.getBirthdayPartyCreations()

        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('| order(order asc)'))
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('creations[]->'))
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('"url": asset->url'))
        expect(result).toEqual(packages)
    })

    it('reads the published Holiday Program schedule in display order', async () => {
        const weeks = [
            {
                _id: 'week-1',
                order: 0,
                title: 'Week 1',
                programs: [
                    {
                        _key: 'program-1',
                        colour: '#21C1EE',
                        creations: ['One', 'Two', 'Three'],
                        date: '2026-09-21',
                        image: { alt: 'Program', url: 'https://example.com/program.jpg' },
                        slot: 'morning',
                        title: 'Explosive Energy',
                    },
                ],
            },
        ]
        fetch.mockResolvedValue(weeks)

        const sanity = await SanityClient.getInstance()
        const result = await sanity.getHolidayProgramSchedule()

        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('*[_type == "holidayProgramWeek"]'))
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('| order(order asc)'))
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('"url": asset->url'))
        expect(result).toEqual(weeks)
    })
})
