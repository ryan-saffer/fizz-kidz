import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, createImageUrlBuilder, fetch, imageUrlBuilder } = vi.hoisted(() => {
    const builder = {
        auto: vi.fn(),
        fit: vi.fn(),
        height: vi.fn(),
        image: vi.fn(),
        url: vi.fn(() => 'https://cdn.sanity.io/cropped-image.jpg'),
        width: vi.fn(),
    }
    builder.auto.mockReturnValue(builder)
    builder.fit.mockReturnValue(builder)
    builder.height.mockReturnValue(builder)
    builder.image.mockReturnValue(builder)
    builder.width.mockReturnValue(builder)

    return {
        createClient: vi.fn(),
        createImageUrlBuilder: vi.fn(() => builder),
        fetch: vi.fn(),
        imageUrlBuilder: builder,
    }
})

vi.mock('@sanity/client', () => ({ createClient }))
vi.mock('@sanity/image-url', () => ({ createImageUrlBuilder }))

describe('SanityClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
        createClient.mockReturnValue({ fetch })
    })

    async function getSanityClient() {
        const { SanityClient } = await import('./sanity.client')
        return SanityClient.getInstance()
    }

    it('allows initialisation to be retried after a failure', async () => {
        createClient.mockImplementationOnce(() => {
            throw new Error('Unavailable')
        })

        await expect(getSanityClient()).rejects.toThrow('Unavailable')
        await expect(getSanityClient()).resolves.toBeDefined()
        expect(createClient).toHaveBeenCalledTimes(2)
    })

    it('reads published Holiday Program instructions in date order', async () => {
        const image = { _key: 'image-1', _type: 'image', asset: { _ref: 'image-1' }, crop: { bottom: 0.1 } }
        fetch.mockResolvedValue([{ _id: 'creation-1', date: '2026-09-21', name: 'Program', instructions: [image] }])

        const sanity = await getSanityClient()
        const result = await sanity.getHolidayProgramCreations()

        expect(createClient).toHaveBeenCalledWith({
            projectId: 'rjsv3y4b',
            dataset: 'production',
            apiVersion: '2026-08-01',
            perspective: 'published',
            useCdn: true,
        })
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('status == "live"'))
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('| order(date asc)'))
        expect(imageUrlBuilder.image).toHaveBeenCalledWith(image)
        expect(result).toEqual([
            {
                _id: 'creation-1',
                date: '2026-09-21',
                name: 'Program',
                instructions: [{ ...image, url: 'https://cdn.sanity.io/cropped-image.jpg' }],
            },
        ])
    })

    it('reads published Birthday Party packages and their ordered creations', async () => {
        const packages = [
            {
                _id: 'package-1',
                name: 'Slime Parties',
                colour: 'yellow',
                creations: [
                    {
                        _id: 'creation-1',
                        name: 'Fairy Slime',
                        instructions: [{ _key: 'image-1', _type: 'image', asset: { _ref: 'image-1' } }],
                    },
                ],
            },
        ]
        fetch.mockResolvedValue(packages)

        const sanity = await getSanityClient()
        const result = await sanity.getBirthdayPartyCreations()

        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('| order(order asc)'))
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('creations[]->'))
        expect(result[0].creations[0].instructions[0]).toEqual({
            _key: 'image-1',
            _type: 'image',
            asset: { _ref: 'image-1' },
            url: 'https://cdn.sanity.io/cropped-image.jpg',
        })
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
                        image: { alt: 'Program', asset: { _ref: 'image-1' } },
                        slot: 'morning',
                        title: 'Explosive Energy',
                    },
                ],
            },
        ]
        fetch.mockResolvedValue(weeks)

        const sanity = await getSanityClient()
        const result = await sanity.getHolidayProgramSchedule()

        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('*[_type == "holidayProgramWeek"]'))
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('| order(order asc)'))
        expect(imageUrlBuilder.width).toHaveBeenCalledWith(1034)
        expect(imageUrlBuilder.height).toHaveBeenCalledWith(727)
        expect(imageUrlBuilder.fit).toHaveBeenCalledWith('crop')
        expect(result[0].programs[0].image.url).toBe('https://cdn.sanity.io/cropped-image.jpg')
    })
})
