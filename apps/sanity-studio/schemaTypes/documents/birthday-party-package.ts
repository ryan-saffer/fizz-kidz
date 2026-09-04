import { DocumentIcon } from '@sanity/icons/Document'
import { defineArrayMember, defineField, defineType, type SanityDocument, type ValidationContext } from 'sanity'

import { BirthdayPartyCardsInput } from '../../components/birthday-party-cards-input'
import { BIRTHDAY_PARTY_CATALOGUE_STATUSES } from '../birthday-party-catalogue-options'

const API_VERSION = '2026-08-01'

const colours = [
    { title: 'Pink', value: 'pink' },
    { title: 'Blue', value: 'blue' },
    { title: 'Yellow', value: 'yellow' },
    { title: 'Green', value: 'green' },
    { title: 'Purple', value: 'purple' },
]

type CardValue = {
    bookingChannels?: string[]
    bookingOrder?: number
    creation?: { _ref?: string }
}

type PartyPackageValue = {
    status?: string
    websiteCards?: CardValue[]
}

function isActiveCataloguePackage(context: ValidationContext) {
    return context.document?.status === 'active'
}

async function isUniquePackageKey(key: string | undefined, context: ValidationContext) {
    if (!key) return true

    const documentId = context.document?._id?.replace(/^drafts\./, '')
    const result = await context.getClient({ apiVersion: API_VERSION }).fetch<{
        duplicateId: string | null
        publishedKey: string | null
    }>(
        `{
            "duplicateId": *[
                _type == "birthdayPartyPackage" &&
                key == $key &&
                !(_id in [$publishedId, $draftId])
            ][0]._id,
            "publishedKey": *[_id == $publishedId][0].key
        }`,
        {
            draftId: documentId ? `drafts.${documentId}` : '',
            key,
            publishedId: documentId ?? '',
        }
    )

    if (result.publishedKey && result.publishedKey !== key) {
        return `The published package key "${result.publishedKey}" cannot be changed.`
    }
    return result.duplicateId ? `The package key "${key}" is already in use.` : true
}

function hasConsistentCards(value: SanityDocument | undefined) {
    const partyPackage = value as PartyPackageValue | undefined
    const cards = partyPackage?.websiteCards ?? []
    const creationReferences = new Set<string>()
    const bookingOrders = new Set<number>()

    for (const card of cards) {
        if (!card.creation?._ref) return 'Every Website card must reference a creation.'
        creationReferences.add(card.creation._ref)

        if ((card.bookingChannels?.length ?? 0) > 0) {
            if (!Number.isInteger(card.bookingOrder) || (card.bookingOrder ?? 0) < 1) {
                return 'Every booking card must have a positive integer booking choice order.'
            }
            if (bookingOrders.has(card.bookingOrder!)) return 'Booking choice order must be unique within a package.'
            bookingOrders.add(card.bookingOrder!)
        } else if (card.bookingOrder !== undefined) {
            return 'Additional display cards cannot have a booking choice order.'
        }
    }

    for (const creationReference of creationReferences) {
        const bookingChoiceCount = cards.filter(
            (card) => card.creation?._ref === creationReference && (card.bookingChannels?.length ?? 0) > 0
        ).length
        if (bookingChoiceCount !== 1) {
            return 'Every creation must have exactly one Website card with booking channels.'
        }
    }
    if (
        bookingOrders.size !== creationReferences.size ||
        !Array.from(bookingOrders).every((order) => order <= creationReferences.size)
    ) {
        return 'Booking choice order must be consecutive from 1.'
    }

    return true
}

export const birthdayPartyPackage = defineType({
    name: 'birthdayPartyPackage',
    title: 'Birthday Party packages',
    type: 'document',
    icon: DocumentIcon,
    initialValue: { status: 'active' },
    validation: (rule) => rule.custom(hasConsistentCards),
    fields: [
        defineField({
            name: 'key',
            title: 'Catalogue key',
            type: 'string',
            description: 'Stable package identity used by the Website and booking system.',
            readOnly: ({ document }) => Boolean(document?._id && !document._id.startsWith('drafts.')),
            validation: (rule) =>
                rule
                    .regex(/^[a-z][a-zA-Z0-9]*$/, { name: 'lower camel case', invert: false })
                    .custom(async (key, context) => {
                        if (context.document?.status && !key) return 'Catalogue packages must have a stable key.'
                        return isUniquePackageKey(key, context)
                    }),
        }),
        defineField({
            name: 'name',
            title: 'Staff package name',
            type: 'string',
            description: 'Existing Portal instruction group name.',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'customerName',
            title: 'Customer-facing name',
            type: 'string',
            validation: (rule) =>
                rule.custom((name, context) =>
                    context.document?.status && !name?.trim()
                        ? 'Catalogue packages must have a customer-facing name.'
                        : true
                ),
        }),
        defineField({
            name: 'status',
            title: 'Status',
            type: 'string',
            options: {
                layout: 'radio',
                list: BIRTHDAY_PARTY_CATALOGUE_STATUSES.map((status) => ({
                    title: status === 'active' ? 'Active' : 'Retired',
                    value: status,
                })),
            },
            description: 'Leave blank only for a legacy staff package that is not part of Party packages.',
        }),
        defineField({
            name: 'colour',
            title: 'Portal colour',
            type: 'string',
            options: { list: colours, layout: 'radio' },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'order',
            title: 'Portal display order',
            type: 'number',
            description: 'Existing Portal instruction order. Keep this intact until the Portal catalogue cutover.',
            validation: (rule) => rule.required().integer().min(0),
        }),
        defineField({
            name: 'catalogueOrder',
            title: 'Website catalogue order',
            type: 'number',
            description: 'Packages with lower numbers appear first on the Website.',
            validation: (rule) =>
                rule
                    .integer()
                    .min(0)
                    .custom((order, context) =>
                        isActiveCataloguePackage(context) && order === undefined
                            ? 'Active catalogue packages must have a Website order.'
                            : true
                    ),
        }),
        defineField({
            name: 'summaryTitle',
            title: 'Catalogue section title',
            type: 'string',
            description: 'Heading shown for this package on the all-creations page.',
            validation: (rule) =>
                rule.custom((title, context) =>
                    isActiveCataloguePackage(context) && !title?.trim()
                        ? 'Active catalogue packages must have a section title.'
                        : true
                ),
        }),
        defineField({
            name: 'accentColour',
            title: 'Catalogue accent colour',
            type: 'string',
            description: 'Six-digit hexadecimal colour used for the catalogue section title.',
            validation: (rule) =>
                rule
                    .regex(/^#[0-9A-F]{6}$/i, {
                        name: 'six-digit hexadecimal colour',
                        invert: false,
                    })
                    .custom((colour, context) =>
                        isActiveCataloguePackage(context) && !colour
                            ? 'Active catalogue packages must have an accent colour.'
                            : true
                    ),
        }),
        defineField({
            name: 'caption',
            title: 'Party page creation caption',
            type: 'string',
        }),
        defineField({
            name: 'hidePartyImage',
            title: 'Hide the party image beside creations',
            type: 'boolean',
            initialValue: false,
        }),
        defineField({
            name: 'blackBackground',
            title: 'Use a black creations background',
            type: 'boolean',
            initialValue: false,
        }),
        defineField({
            name: 'websiteCards',
            title: 'Website cards',
            type: 'array',
            description:
                'This is the package creation list. Drag cards into Website order; configure booking channels on exactly one card per creation.',
            components: { input: BirthdayPartyCardsInput },
            of: [defineArrayMember({ type: 'birthdayPartyCreationCard' })],
            validation: (rule) =>
                rule.custom((cards, context) =>
                    isActiveCataloguePackage(context) && !cards?.length
                        ? 'Active catalogue packages must contain at least one Website card.'
                        : true
                ),
        }),
        defineField({
            name: 'websitePage',
            title: 'Website page',
            type: 'birthdayPartyWebsitePage',
            description:
                'Controls this package’s generated page, menu item, Party Themes card, SEO, and optional feature sections.',
            validation: (rule) =>
                rule.custom((page, context) =>
                    isActiveCataloguePackage(context) && !page
                        ? 'Active catalogue packages must have complete Website page content.'
                        : true
                ),
        }),
        defineField({
            name: 'creations',
            title: 'Creation instructions (legacy)',
            type: 'array',
            description:
                'Existing Portal instruction order. Keep this intact until the Portal reads instructions through party-package creations.',
            of: [defineArrayMember({ type: 'reference', to: [{ type: 'birthdayPartyCreation' }] })],
            validation: (rule) => rule.required().min(1).unique(),
        }),
        defineField({
            name: 'migrationSource',
            title: 'Migration source',
            type: 'string',
            hidden: true,
            readOnly: true,
        }),
    ],
    preview: {
        select: {
            creationImage: 'websiteCards.0.creation.image',
            key: 'key',
            media: 'websiteCards.0.image',
            order: 'catalogueOrder',
            staffTitle: 'name',
            status: 'status',
            title: 'customerName',
        },
        prepare: ({ creationImage, key, media, order, staffTitle, status, title }) => ({
            title: title ?? staffTitle ?? 'Untitled package',
            subtitle: [
                key && Number.isFinite(order) ? `${order}: ${key}` : 'Legacy staff-only package',
                status === 'retired' ? 'Retired' : undefined,
            ]
                .filter(Boolean)
                .join(' · '),
            media: media ?? creationImage,
        }),
    },
})
