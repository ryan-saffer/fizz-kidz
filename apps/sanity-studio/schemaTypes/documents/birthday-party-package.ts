import { DocumentIcon } from '@sanity/icons/Document'
import { defineArrayMember, defineField, defineType, type SanityDocument, type ValidationContext } from 'sanity'

import {
    BIRTHDAY_PARTY_CATALOGUE_STATUSES,
    BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS,
    isBirthdayPartyPackageColour,
    isBirthdayPartyPackageColourHex,
} from '@fizz-kidz/core'

import { BirthdayPartyCardsInput } from '../../components/birthday-party-cards-input'
import { hasValidPackageCreationReferences } from '../birthday-party-catalogue-validation'

const API_VERSION = '2026-08-01'

type CardValue = {
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
    const perspective = context.document?._id?.startsWith('drafts.') ? 'drafts' : 'published'
    const duplicateId = await context
        .getClient({ apiVersion: API_VERSION })
        .withConfig({ perspective, useCdn: false })
        .fetch<string | null>(
            `*[
                _type == "birthdayPartyPackage" &&
                status == "active" &&
                position == $position &&
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

    for (const card of cards) {
        if (!card.creation?._ref) return 'Every Website card must reference a creation.'
    }

    return true
}

export const birthdayPartyPackage = defineType({
    name: 'birthdayPartyPackage',
    title: 'Birthday Party packages',
    type: 'document',
    icon: DocumentIcon,
    initialValue: { status: 'active' },
    validation: (rule) => rule.custom(hasConsistentCards).custom(hasValidPackageCreationReferences),
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
                rule.custom((name) => {
                    const packageName = name?.trim()
                    if (!packageName) return 'Packages must have a package name.'
                    return packageName && /\s+Parties$/i.test(packageName)
                        ? 'Enter the base package name without “Parties”; that label is added automatically.'
                        : true
                }),
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
            description: 'Leave blank only for a staff-only package that is not part of the customer catalogue.',
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
                rule
                    .required()
                    .custom((colour) =>
                        isBirthdayPartyPackageColour(colour) ? true : 'Select a valid primary colour.'
                    ),
        }),
        defineField({
            name: 'position',
            title: 'Position',
            type: 'number',
            description:
                'Controls this package’s position in Portal creation instructions and, for active packages, the Website menu, Party Themes cards, and all-creations catalogue. Use Birthday Parties > Reorder and publish packages to insert or move packages without renumbering them individually.',
            group: 'core',
            validation: (rule) =>
                rule
                    .integer()
                    .min(1)
                    .custom((position, context) => {
                        if (!isActiveCataloguePackage(context)) return true
                        if (position === undefined) {
                            return 'Active catalogue packages must have a Website position.'
                        }
                        return isUniquePosition(position, context)
                    }),
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
                'This is the package creation list. Drag cards into the order used by both the Website and booking menus. If a creation has multiple presentation cards, its first card sets its booking-menu position. Availability is controlled by the creation.',
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
            title: 'Staff-only creation instructions',
            type: 'array',
            description:
                'Direct instruction list for staff-only packages such as Sweet Kitty. Customer catalogue packages derive instructions through their creations.',
            group: 'core',
            hidden: ({ document }) => Boolean(document?.status),
            of: [defineArrayMember({ type: 'reference', to: [{ type: 'birthdayPartyCreation' }] })],
            validation: (rule) =>
                rule
                    .unique()
                    .custom((instructions, context) =>
                        context.document?.status || instructions?.length
                            ? true
                            : 'Staff-only packages must contain at least one creation instruction.'
                    ),
        }),
    ],
    preview: {
        select: {
            creationImage: 'websiteCards.0.creation.image',
            key: 'key',
            media: 'websiteCards.0.image',
            position: 'position',
            status: 'status',
            title: 'packageName',
        },
        prepare: ({ creationImage, key, media, position, status, title }) => {
            return {
                title: title ?? 'Untitled package',
                subtitle: [
                    key && Number.isFinite(position) ? `${position}: ${key}` : 'Staff-only package',
                    status === 'retired' ? 'Retired' : undefined,
                ]
                    .filter(Boolean)
                    .join(' · '),
                media: media ?? creationImage,
            }
        },
    },
})
