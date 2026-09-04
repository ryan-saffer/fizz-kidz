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

type OfferingEntryValue = {
    offering?: { _ref?: string }
}

type CardValue = {
    offering?: { _ref?: string }
    useForBookingChoice?: boolean
}

type PartyPackageValue = {
    offeringEntries?: OfferingEntryValue[]
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

function hasUniqueOfferings(entries: OfferingEntryValue[] | undefined) {
    if (!entries) return true

    const references = entries.flatMap((entry) => (entry.offering?._ref ? [entry.offering._ref] : []))
    return new Set(references).size === references.length
        ? true
        : 'Each customer offering can appear only once in a package. Add multiple cards to one offering instead.'
}

function hasConsistentCards(value: SanityDocument | undefined) {
    const partyPackage = value as PartyPackageValue | undefined
    const offeringReferences = new Set(
        (partyPackage?.offeringEntries ?? []).flatMap((entry) => (entry.offering?._ref ? [entry.offering._ref] : []))
    )
    const cards = partyPackage?.websiteCards ?? []

    for (const card of cards) {
        if (!card.offering?._ref || !offeringReferences.has(card.offering._ref)) {
            return 'Every Website card must reference an offering selected in this package.'
        }
    }

    for (const offeringReference of offeringReferences) {
        const bookingChoiceCount = cards.filter(
            (card) => card.offering?._ref === offeringReference && card.useForBookingChoice
        ).length
        if (bookingChoiceCount !== 1) {
            return 'Every package offering must have exactly one Website card selected as its booking choice image.'
        }
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
            description: 'Leave blank only for a legacy staff package that is not part of the customer catalogue.',
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
            name: 'offeringEntries',
            title: 'Customer catalogue offerings',
            type: 'array',
            description: 'Drag offerings into the order customer booking choices should use.',
            of: [defineArrayMember({ type: 'birthdayPartyOfferingEntry' })],
            validation: (rule) =>
                rule.custom((entries, context) => {
                    if (isActiveCataloguePackage(context) && !entries?.length) {
                        return 'Active catalogue packages must contain at least one offering.'
                    }
                    return hasUniqueOfferings(entries as OfferingEntryValue[] | undefined)
                }),
        }),
        defineField({
            name: 'websiteCards',
            title: 'Website cards',
            type: 'array',
            description:
                'Drag cards into the exact order customers should see them. Multiple cards may represent one offering.',
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
            name: 'creations',
            title: 'Staff recipes (legacy)',
            type: 'array',
            description:
                'Existing Portal instruction order. Keep this intact until the Portal reads recipes through customer offerings.',
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
            key: 'key',
            media: 'websiteCards.0.image',
            order: 'catalogueOrder',
            staffTitle: 'name',
            status: 'status',
            title: 'customerName',
        },
        prepare: ({ key, media, order, staffTitle, status, title }) => ({
            title: title ?? staffTitle ?? 'Untitled package',
            subtitle: [
                key && Number.isFinite(order) ? `${order}: ${key}` : 'Legacy staff-only package',
                status === 'retired' ? 'Retired' : undefined,
            ]
                .filter(Boolean)
                .join(' · '),
            media,
        }),
    },
})
