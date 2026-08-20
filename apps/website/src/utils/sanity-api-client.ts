import { createClient } from '@sanity/client'
import { createImageUrlBuilder } from '@sanity/image-url'

import type { HolidayProgramScheduleWeek } from '@fizz-kidz/core'

import type { WebsiteImage } from '@/types/images'

const HOLIDAY_PROGRAM_SCHEDULE_QUERY = `
    *[_type == "holidayProgramWeek"] | order(order asc) {
        _id,
        order,
        title,
        programs[] {
            _key,
            colour,
            creations,
            date,
            image {
                ...,
                alt,
            },
            slot,
            title
        }
    }
`

const WEBSITE_IMAGES_QUERY = `
    *[_type == "websiteImage"] {
        key,
        "assetId": image.asset->_id,
        "src": image.asset->url,
        "width": image.asset->metadata.dimensions.width,
        "height": image.asset->metadata.dimensions.height
    }
`

const client = createClient({
    projectId: 'rjsv3y4b',
    dataset: 'production',
    apiVersion: '2026-08-01',
    perspective: 'published',
    useCdn: false,
})
const imageUrlBuilder = createImageUrlBuilder(client)

export const sanityClient = {
    async getWebsiteImages() {
        const images = await client.fetch<Array<WebsiteImage & { key: string }>>(WEBSITE_IMAGES_QUERY)
        return Object.fromEntries(images.map(({ key, ...image }) => [key, image]))
    },
    async getHolidayProgramSchedule() {
        const weeks = await client.fetch<HolidayProgramScheduleWeek[]>(HOLIDAY_PROGRAM_SCHEDULE_QUERY)
        return weeks.map((week) => ({
            ...week,
            programs: week.programs.map((program) => ({
                ...program,
                image: {
                    ...program.image,
                    url: imageUrlBuilder
                        .image(program.image as Parameters<typeof imageUrlBuilder.image>[0])
                        .width(1034)
                        .height(727)
                        .fit('crop')
                        .auto('format')
                        .url(),
                },
            })),
        }))
    },
}
