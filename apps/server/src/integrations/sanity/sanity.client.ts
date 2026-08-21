import type {
    BirthdayPartyCreationInstructionGroup,
    CreationInstructionsContent,
    HolidayProgramCreationInstructions,
    HolidayProgramScheduleWeek,
} from '@fizz-kidz/core'

import type { SanityClient as Client } from '@sanity/client'
import type { ImageUrlBuilder, SanityImageSource } from '@sanity/image-url'

const HOLIDAY_PROGRAM_CREATIONS_QUERY = `
    *[_type == "holidayProgramCreation" && status == "live"] | order(date asc) {
        _id,
        date,
        name,
        instructions[] {
            ...
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
                ...
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
                ...,
                alt,
            },
            slot,
            title
        }
    }
`

export class SanityClient {
    private static instance: SanityClient

    private static initialisation: Promise<void> | null = null

    #client: Client | null = null

    #imageUrlBuilder: ImageUrlBuilder | null = null

    private constructor() {}

    static async getInstance() {
        const instance = (SanityClient.instance ??= new SanityClient())
        if (!instance.#client) {
            SanityClient.initialisation ??= instance.#initialise().finally(() => {
                SanityClient.initialisation = null
            })
            await SanityClient.initialisation
        }
        return instance
    }

    get #sanity() {
        if (this.#client) return this.#client
        throw new Error('Sanity client not initialised')
    }

    get #imageUrls() {
        if (this.#imageUrlBuilder) return this.#imageUrlBuilder
        throw new Error('Sanity image URL builder not initialised')
    }

    async #initialise() {
        try {
            const [{ createClient }, { createImageUrlBuilder }] = await Promise.all([
                import('@sanity/client'),
                import('@sanity/image-url'),
            ])
            const client = createClient({
                projectId: 'rjsv3y4b',
                dataset: 'production',
                apiVersion: '2026-08-01',
                perspective: 'published',
                useCdn: true,
            })
            this.#client = client
            this.#imageUrlBuilder = createImageUrlBuilder(client)
        } catch (error) {
            this.#client = null
            this.#imageUrlBuilder = null
            throw error
        }
    }

    #resolveInstructionImages(instructions: CreationInstructionsContent) {
        return instructions.map((instruction) =>
            instruction._type === 'image'
                ? {
                      ...instruction,
                      url: this.#imageUrls
                          .image(instruction as SanityImageSource)
                          .auto('format')
                          .url(),
                  }
                : instruction
        )
    }

    async getHolidayProgramCreations() {
        const creations = await this.#sanity.fetch<HolidayProgramCreationInstructions[]>(
            HOLIDAY_PROGRAM_CREATIONS_QUERY
        )
        return creations.map((creation) => ({
            ...creation,
            instructions: this.#resolveInstructionImages(creation.instructions),
        }))
    }

    async getBirthdayPartyCreations() {
        const groups = await this.#sanity.fetch<BirthdayPartyCreationInstructionGroup[]>(BIRTHDAY_PARTY_CREATIONS_QUERY)
        return groups.map((group) => ({
            ...group,
            creations: group.creations.map((creation) => ({
                ...creation,
                instructions: this.#resolveInstructionImages(creation.instructions),
            })),
        }))
    }

    async getHolidayProgramSchedule() {
        const weeks = await this.#sanity.fetch<HolidayProgramScheduleWeek[]>(HOLIDAY_PROGRAM_SCHEDULE_QUERY)
        return weeks.map((week) => ({
            ...week,
            programs: week.programs.map((program) => ({
                ...program,
                image: {
                    ...program.image,
                    url: this.#imageUrls
                        .image(program.image as SanityImageSource)
                        .width(1034)
                        .height(727)
                        .fit('crop')
                        .auto('format')
                        .url(),
                },
            })),
        }))
    }
}
