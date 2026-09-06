import { DocumentIcon } from '@sanity/icons/Document'
import { defineArrayMember, defineField, defineType, type SanityDocument, type ValidationContext } from 'sanity'

import {
    BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS,
    isBirthdayPartyPackageColour,
    isBirthdayPartyPackageColourHex,
} from '@fizz-kidz/core'

import { BirthdayPartyCardsInput } from '../../components/birthday-party-cards-input'
import { BIRTHDAY_PARTY_CATALOGUE_STATUSES } from '../birthday-party-catalogue-options'

const API_VERSION = '2026-08-01'

type CardValue = {
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

async function isUniquePosition(position: number | undefined, context: ValidationContext) {
    if (position === undefined) return true

    const documentId = context.document?._id?.replace(/^drafts\./, '')
    const duplicateId = await context.getClient({ apiVersion: API_VERSION }).fetch<string | null>(
        `*[
            _type == "birthdayPartyPackage" &&
            status == "active" &&
            coalesce(position, websitePage.navigation.order, catalogueOrder, websitePage.themeCard.order) == $position &&
            !(_id in [$publishedId, $draftId])
        ][0]._id`,
        {
            draftId: documentId ? `drafts.${documentId}` : '',
            position,
            publishedId: documentId ?? '',
        }
    )
    return duplicateId ? `Website position ${position} is already in use.` : true
}

function hasConsistentCards(value: SanityDocument | undefined) {
    const partyPackage = value as PartyPackageValue | undefined
    const cards = partyPackage?.websiteCards ?? []
    const creationReferences = new Set<string>()
    const bookingOrders = new Set<number>()

    for (const card of cards) {
        if (!card.creation?._ref) return 'Every Website card must reference a creation.'
        creationReferences.add(card.creation._ref)

        if (card.bookingOrder !== undefined) {
            if (!Number.isInteger(card.bookingOrder) || (card.bookingOrder ?? 0) < 1) {
                return 'Every booking choice order must be a positive integer.'
            }
            if (bookingOrders.has(card.bookingOrder!)) return 'Booking choice order must be unique within a package.'
            bookingOrders.add(card.bookingOrder!)
        }
    }

    for (const creationReference of creationReferences) {
        const bookingChoiceCount = cards.filter(
            (card) => card.creation?._ref === creationReference && card.bookingOrder !== undefined
        ).length
        if (bookingChoiceCount !== 1) {
            return 'Every creation must have exactly one Website card with a booking choice order.'
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
    groups: [
        { name: 'core', title: 'Core package information', default: true },
        { name: 'website', title: 'Website' },
    ],
    orderings: [
        {
            title: 'Website position',
            name: 'positionAsc',
            by: [
                { field: 'position', direction: 'asc' },
                { field: 'packageName', direction: 'asc' },
            ],
        },
    ],
    fields: [
        defineField({
            name: 'key',
            title: 'Catalogue key',
            type: 'string',
            description: 'Stable package identity used by the Website and booking system.',
            group: 'core',
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
            name: 'packageName',
            title: 'Package name',
            type: 'string',
            description: 'Base name only. Labels such as “Parties” and “Creations” are added automatically.',
            group: 'core',
            validation: (rule) =>
                rule.custom((name, context) => {
                    const packageName = name?.trim()
                    const legacyName = [context.document?.customerName, context.document?.name].find(
                        (value) => typeof value === 'string' && value.trim()
                    )
                    if (!packageName && !legacyName) return 'Packages must have a package name.'
                    return packageName && /\s+Parties$/i.test(packageName)
                        ? 'Enter the base package name without “Parties”; that label is added automatically.'
                        : true
                }),
        }),
        defineField({
            name: 'name',
            title: 'Staff package name (legacy compatibility)',
            type: 'string',
            group: 'core',
            deprecated: { reason: 'Use Package name. Retained temporarily for the deployed Portal.' },
            hidden: true,
            readOnly: true,
        }),
        defineField({
            name: 'customerName',
            title: 'Customer-facing name (deprecated)',
            type: 'string',
            group: 'core',
            deprecated: { reason: 'Use Package name. Customer labels are derived automatically.' },
            hidden: true,
            readOnly: true,
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
            group: 'core',
        }),
        defineField({
            name: 'primaryColour',
            title: 'Primary colour',
            type: 'string',
            description: 'Used for the package page introduction and the Portal instruction group.',
            group: 'core',
            options: {
                list: BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS.map(({ title, value }) => ({ title, value })),
                layout: 'radio',
            },
            validation: (rule) =>
                rule.custom((colour, context) => {
                    const value = colour ?? context.document?.colour
                    if (!value) return 'Packages must have a primary colour.'
                    return isBirthdayPartyPackageColour(value) ? true : 'Select a valid primary colour.'
                }),
        }),
        defineField({
            name: 'colour',
            title: 'Portal colour (deprecated)',
            type: 'string',
            group: 'core',
            deprecated: { reason: 'Use Primary colour.' },
            hidden: true,
            readOnly: true,
        }),
        defineField({
            name: 'order',
            title: 'Portal instructions order (migration only)',
            type: 'number',
            description:
                'Used only by the currently deployed Portal. Do not edit. Delete this field after the coordinated production cutover is verified.',
            deprecated: { reason: 'Replaced by Position. Retained temporarily for the deployed Portal.' },
            group: 'core',
            readOnly: true,
        }),
        defineField({
            name: 'position',
            title: 'Position',
            type: 'number',
            description:
                'Controls this package’s position in Portal creation instructions and, for active packages, the Website menu, Party Themes cards, and all-creations catalogue. Lower numbers appear first.',
            group: 'core',
            validation: (rule) =>
                rule
                    .integer()
                    .min(1)
                    .custom((position, context) => {
                        if (isActiveCataloguePackage(context) && position === undefined) {
                            return 'Active catalogue packages must have a Website position.'
                        }
                        return isUniquePosition(position, context)
                    }),
        }),
        defineField({
            name: 'catalogueOrder',
            title: 'Website catalogue order (deprecated)',
            type: 'number',
            deprecated: { reason: 'Use Position. Retained temporarily for the deployed Website.' },
            group: 'website',
            hidden: true,
            readOnly: true,
        }),
        defineField({
            name: 'summaryTitle',
            title: 'Catalogue section title (deprecated)',
            type: 'string',
            group: 'website',
            deprecated: { reason: 'The heading is derived from Package name.' },
            hidden: true,
            readOnly: true,
        }),
        defineField({
            name: 'accentColour',
            title: 'Accent colour',
            type: 'string',
            description: 'Used for the all-creations heading and Party Themes card.',
            group: 'core',
            options: {
                list: BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS.map(({ hex, title }) => ({ title, value: hex })),
                layout: 'radio',
            },
            validation: (rule) =>
                rule.custom((colour, context) => {
                    if (isActiveCataloguePackage(context) && !colour) {
                        return 'Active catalogue packages must have an accent colour.'
                    }
                    return !colour || isBirthdayPartyPackageColourHex(colour) ? true : 'Select a valid accent colour.'
                }),
        }),
        defineField({
            name: 'caption',
            title: 'Party page creation caption',
            type: 'string',
            group: 'website',
        }),
        defineField({
            name: 'hidePartyImage',
            title: 'Hide the party image beside creations',
            type: 'boolean',
            initialValue: false,
            group: 'website',
        }),
        defineField({
            name: 'blackBackground',
            title: 'Use a black creations background',
            type: 'boolean',
            description: 'Special presentation used for Fluid Bears parties.',
            initialValue: false,
            group: 'website',
        }),
        defineField({
            name: 'websiteCards',
            title: 'Website cards',
            type: 'array',
            description:
                'This is the package creation list. Drag cards into Website order; set a booking choice order on exactly one card per creation. Availability is controlled by the creation.',
            group: 'core',
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
            group: 'website',
            validation: (rule) =>
                rule.custom((page, context) =>
                    isActiveCataloguePackage(context) && !page
                        ? 'Active catalogue packages must have complete Website page content.'
                        : true
                ),
        }),
        defineField({
            name: 'creations',
            title: 'Creation instructions (migration only)',
            type: 'array',
            description:
                'Used by the currently deployed Portal and the Sweet Kitty staff-only fallback. Do not edit. Delete after the coordinated cutover is verified and Sweet Kitty uses the new creation relationships.',
            deprecated: {
                reason: 'Active packages now derive instructions through Website card creations. Retained temporarily for migration.',
            },
            group: 'core',
            readOnly: true,
            of: [defineArrayMember({ type: 'reference', to: [{ type: 'birthdayPartyCreation' }] })],
        }),
        defineField({
            name: 'migrationSource',
            title: 'Migration source',
            type: 'string',
            group: 'core',
            hidden: true,
            readOnly: true,
        }),
    ],
    preview: {
        select: {
            creationImage: 'websiteCards.0.creation.image',
            key: 'key',
            legacyPosition: 'websitePage.navigation.order',
            media: 'websiteCards.0.image',
            position: 'position',
            status: 'status',
            title: 'packageName',
            legacyCustomerTitle: 'customerName',
            legacyStaffTitle: 'name',
        },
        prepare: ({
            creationImage,
            key,
            legacyCustomerTitle,
            legacyPosition,
            legacyStaffTitle,
            media,
            position,
            status,
            title,
        }) => {
            const websitePosition = position ?? legacyPosition
            return {
                title: title ?? legacyCustomerTitle ?? legacyStaffTitle ?? 'Untitled package',
                subtitle: [
                    key && Number.isFinite(websitePosition)
                        ? `${websitePosition}: ${key}`
                        : 'Legacy staff-only package',
                    status === 'retired' ? 'Retired' : undefined,
                ]
                    .filter(Boolean)
                    .join(' · '),
                media: media ?? creationImage,
            }
        },
    },
})
