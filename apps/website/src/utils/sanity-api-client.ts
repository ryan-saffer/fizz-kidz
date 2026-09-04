import { createClient } from '@sanity/client'
import { createImageUrlBuilder } from '@sanity/image-url'

import {
    validateBirthdayPartyCatalogue,
    type BirthdayPartyCatalogue,
    type BirthdayPartyCatalogueCreation,
    type BirthdayPartyCreationCard,
    type HolidayProgramScheduleWeek,
} from '@fizz-kidz/core'

const BIRTHDAY_PARTY_CATALOGUE_QUERY = `
    *[_type == "birthdayPartyPackage" && status == "active"] | order(catalogueOrder asc) {
        _id,
        accentColour,
        blackBackground,
        caption,
        hidePartyImage,
        key,
        "name": customerName,
        "cards": websiteCards[] {
            _key,
            alt,
            "bookingChannels": coalesce(bookingChannels, []),
            bookingOrder,
            colour,
            creation->{
                _id,
                image {
                    ...,
                    "assetId": asset->_id,
                    "width": asset->metadata.dimensions.width,
                    "height": asset->metadata.dimensions.height
                },
                key,
                "legacyLabels": coalesce(legacyLabels, []),
                name,
                recipe->{_id, name},
                status
            },
            hideLabel,
            image {
                ...,
                "assetId": asset->_id,
                "width": asset->metadata.dimensions.width,
                "height": asset->metadata.dimensions.height
            },
            label
        },
        "order": catalogueOrder,
        status,
        summaryTitle
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

type SanityImage = {
    asset: { _ref: string }
    assetId: string
    crop?: { bottom: number; left: number; right: number; top: number }
    height: number
    hotspot?: { height: number; width: number; x: number; y: number }
    width: number
}

type WebsiteImageRecord = {
    image: SanityImage
    key: string
}

type SanityCatalogueCreation = Omit<BirthdayPartyCatalogueCreation, 'image'> & { image?: SanityImage }

type SanityCreationCard = Omit<
    BirthdayPartyCreationCard,
    'alt' | 'bookingChannels' | 'creation' | 'image' | 'label'
> & {
    alt?: string
    bookingChannels?: BirthdayPartyCreationCard['bookingChannels']
    creation?: SanityCatalogueCreation
    hideLabel?: boolean
    image?: SanityImage
    label?: string[]
}

type BirthdayPartyCatalogueRecord = Omit<BirthdayPartyCatalogue['packages'][number], 'cards'> & {
    cards?: SanityCreationCard[]
}

const client = createClient({
    projectId: 'rjsv3y4b',
    dataset: 'production',
    apiVersion: '2026-08-01',
    perspective: 'published',
    useCdn: false,
})
const imageUrlBuilder = createImageUrlBuilder(client)

function resolveImage(image: SanityImage) {
    const crop = image.crop ?? { bottom: 0, left: 0, right: 0, top: 0 }
    const cropLeft = Math.round(image.width * crop.left)
    const cropTop = Math.round(image.height * crop.top)
    return {
        assetId: image.assetId,
        src: imageUrlBuilder.image(image).auto('format').url(),
        width: Math.max(1, Math.round(image.width - image.width * crop.right - cropLeft)),
        height: Math.max(1, Math.round(image.height - image.height * crop.bottom - cropTop)),
    }
}

function resolveCatalogueImage(image: SanityImage | undefined) {
    if (!image?.asset?._ref || !image.assetId || !Number.isFinite(image.width) || !Number.isFinite(image.height)) {
        return { assetId: '', height: 0, src: '', width: 0 }
    }
    return resolveImage(image)
}

export const sanityClient = {
    async getBirthdayPartyCatalogue() {
        const packages = await client.fetch<BirthdayPartyCatalogueRecord[]>(BIRTHDAY_PARTY_CATALOGUE_QUERY)
        return validateBirthdayPartyCatalogue({
            packages: packages.map((partyPackage) => ({
                ...partyPackage,
                cards: (partyPackage.cards ?? []).map((card) => {
                    const creation = card.creation
                        ? {
                              ...card.creation,
                              image: resolveCatalogueImage(card.creation.image),
                          }
                        : undefined

                    return {
                        _key: card._key,
                        alt: card.alt?.trim() || (creation?.name ? `${creation.name} creation` : ''),
                        bookingChannels: card.bookingChannels ?? [],
                        bookingOrder: card.bookingOrder ?? undefined,
                        colour: card.colour,
                        creation: creation as BirthdayPartyCatalogueCreation,
                        image: resolveCatalogueImage(card.image ?? card.creation?.image),
                        label: card.hideLabel
                            ? []
                            : card.label?.length
                              ? card.label
                              : creation?.name
                                ? [creation.name]
                                : [],
                    }
                }),
            })),
        })
    },
    async getWebsiteImages() {
        const images = await client.fetch<WebsiteImageRecord[]>(WEBSITE_IMAGES_QUERY)
        return Object.fromEntries(images.map(({ image, key }) => [key, resolveImage(image)]))
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
