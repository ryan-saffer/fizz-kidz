import { createClient } from '@sanity/client'
import { createImageUrlBuilder } from '@sanity/image-url'

import type { HolidayProgramScheduleWeek } from '@fizz-kidz/core'

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
        image {
            ...,
            "assetId": asset->_id,
            "width": asset->metadata.dimensions.width,
            "height": asset->metadata.dimensions.height
        }
    }
`

type WebsiteImageRecord = {
    image: {
        asset: { _ref: string }
        assetId: string
        crop?: { bottom: number; left: number; right: number; top: number }
        height: number
        width: number
    }
    key: string
}

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
        const images = await client.fetch<WebsiteImageRecord[]>(WEBSITE_IMAGES_QUERY)
        return Object.fromEntries(
            images.map(({ image, key }) => {
                const crop = image.crop ?? { bottom: 0, left: 0, right: 0, top: 0 }
                const cropLeft = Math.round(image.width * crop.left)
                const cropTop = Math.round(image.height * crop.top)
                return [
                    key,
                    {
                        assetId: image.assetId,
                        src: imageUrlBuilder.image(image).auto('format').url(),
                        width: Math.max(1, Math.round(image.width - image.width * crop.right - cropLeft)),
                        height: Math.max(1, Math.round(image.height - image.height * crop.bottom - cropTop)),
                    },
                ]
            })
        )
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
