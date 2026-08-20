import type {
    BirthdayPartyCreationInstructionGroup,
    HolidayProgramCreationInstructions,
    HolidayProgramScheduleWeek,
} from '@fizz-kidz/core'

import type { ClientStatus } from '@/shared/lazy-client/client-status'
import type { SanityClient as Client } from '@sanity/client'

const HOLIDAY_PROGRAM_CREATIONS_QUERY = `
    *[_type == "holidayProgramCreation"] | order(date asc) {
        _id,
        date,
        name,
        instructions[] {
            ...,
            _type == "image" => {
                "url": asset->url
            }
        }
    }
`

const BIRTHDAY_PARTY_CREATIONS_QUERY = `
    *[_type == "birthdayPartyPackage"] | order(order asc) {
        _id,
        name,
        colour,
        creations[]-> {
            _id,
            name,
            instructions[] {
                ...,
                _type == "image" => {
                    "url": asset->url
                }
            }
        }
    }
`

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
                alt,
                "url": asset->url
            },
            slot,
            title
        }
    }
`

export class SanityClient {
    private static instance: SanityClient

    #status: ClientStatus = 'not-initialised'

    #client: Client | null = null

    private constructor() {}

    static async getInstance() {
        if (!SanityClient.instance) {
            SanityClient.instance = new SanityClient()
            await SanityClient.instance.#initialise()
        }
        while (SanityClient.instance.#status === 'initialising') {
            await new Promise((resolve) => setTimeout(resolve, 20))
        }
        return SanityClient.instance
    }

    get #sanity() {
        if (this.#client) return this.#client
        throw new Error('Sanity client not initialised')
    }

    async #initialise() {
        this.#status = 'initialising'
        const { createClient } = await import('@sanity/client')
        this.#client = createClient({
            projectId: 'rjsv3y4b',
            dataset: 'production',
            apiVersion: '2026-08-01',
            perspective: 'published',
            useCdn: true,
        })
        this.#status = 'initialised'
    }

    getHolidayProgramCreations() {
        return this.#sanity.fetch<HolidayProgramCreationInstructions[]>(HOLIDAY_PROGRAM_CREATIONS_QUERY)
    }

    getBirthdayPartyCreations() {
        return this.#sanity.fetch<BirthdayPartyCreationInstructionGroup[]>(BIRTHDAY_PARTY_CREATIONS_QUERY)
    }

    getHolidayProgramSchedule() {
        return this.#sanity.fetch<HolidayProgramScheduleWeek[]>(HOLIDAY_PROGRAM_SCHEDULE_QUERY)
    }
}
