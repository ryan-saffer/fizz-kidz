import type {
    BirthdayPartyBookingCatalogue,
    BirthdayPartyCreationInstructionGroup,
    CreationInstructionsContent,
    HolidayProgramCreationInstructions,
    HolidayProgramScheduleWeek,
} from '@fizz-kidz/core'
import { getBirthdayPartyPackagePartyName, validateBirthdayPartyBookingCatalogue } from '@fizz-kidz/core'

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
    *[_type == "birthdayPartyPackage" && (!defined(status) || status == "active")]
        | order(position asc) {
        _id,
        "name": packageName,
        "colour": primaryColour,
        status,
        "creationCards": websiteCards[
            defined(creation->creationInstructions)
        ] {
            _key,
            "creationInstructions": creation->creationInstructions-> {
                _id,
                name,
                instructions[] {
                    ...
                }
            }
        },
        "staffCreationInstructions": creations[]-> {
            _id,
            name,
            instructions[] {
                ...
            }
        }
    }
`

type BirthdayPartyInstructionGroupRecord = Omit<BirthdayPartyCreationInstructionGroup, 'creations'> & {
    creationCards?: Array<{
        _key: string
        creationInstructions?: BirthdayPartyCreationInstructionGroup['creations'][number]
    }>
    staffCreationInstructions?: BirthdayPartyCreationInstructionGroup['creations']
    status?: string
}

const BIRTHDAY_PARTY_BOOKING_CATALOGUE_QUERY = `
    {
        "creations": *[_type == "birthdayPartyCreationOffering"] | order(name asc) {
            "bookingChannels": coalesce(bookingChannels, []),
            key,
            "legacyLabels": coalesce(legacyLabels, []),
            name,
            status
        },
        "packages": *[
            _type == "birthdayPartyPackage" &&
            defined(key) &&
            status in ["active", "retired"]
        ] | order(position asc) {
            "creations": websiteCards[] {
                _key,
                "key": creation->key
            },
            key,
            "name": packageName,
            position,
            status
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
        const groups = await this.#sanity.fetch<BirthdayPartyInstructionGroupRecord[]>(BIRTHDAY_PARTY_CREATIONS_QUERY)
        return groups.map((group) => ({
            _id: group._id,
            colour: group.colour,
            name: getBirthdayPartyPackagePartyName(group.name),
            creations: Array.from(
                new Map(
                    (group.status === 'active'
                        ? (group.creationCards ?? []).flatMap((card) =>
                              card.creationInstructions ? [card.creationInstructions] : []
                          )
                        : (group.staffCreationInstructions ?? [])
                    ).map((creation) => [creation._id, creation] as const)
                ).values()
            ).map((creation) => ({
                ...creation,
                instructions: this.#resolveInstructionImages(creation.instructions),
            })),
        }))
    }

    async getBirthdayPartyBookingCatalogue() {
        const catalogue = await this.#sanity
            .withConfig({ useCdn: false })
            .fetch<BirthdayPartyBookingCatalogue>(BIRTHDAY_PARTY_BOOKING_CATALOGUE_QUERY)
        return validateBirthdayPartyBookingCatalogue({
            creations: catalogue.creations,
            packages: catalogue.packages.map((partyPackage) => ({
                ...partyPackage,
                creations: Array.from(
                    new Map(partyPackage.creations.map((creation) => [creation.key, creation] as const)).values()
                ),
            })),
        })
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
