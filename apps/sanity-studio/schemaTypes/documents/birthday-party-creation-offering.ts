import { ComposeSparklesIcon } from '@sanity/icons/ComposeSparkles'
import { defineArrayMember, defineField, defineType, type ValidationContext } from 'sanity'

import { BIRTHDAY_PARTY_CATALOGUE_STATUSES } from '../birthday-party-catalogue-options'

const API_VERSION = '2026-08-01'

async function isUniqueOfferingKey(key: string | undefined, context: ValidationContext) {
    if (!key) return true

    const documentId = context.document?._id?.replace(/^drafts\./, '')
    const result = await context.getClient({ apiVersion: API_VERSION }).fetch<{
        duplicateId: string | null
        publishedKey: string | null
    }>(
        `{
            "duplicateId": *[
                _type == "birthdayPartyCreationOffering" &&
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
        return `The published catalogue key "${result.publishedKey}" cannot be changed.`
    }
    return result.duplicateId ? `The catalogue key "${key}" is already in use.` : true
}

export const birthdayPartyCreationOffering = defineType({
    name: 'birthdayPartyCreationOffering',
    title: 'Customer creation offering',
    type: 'document',
    icon: ComposeSparklesIcon,
    initialValue: { status: 'active' },
    fields: [
        defineField({
            name: 'key',
            title: 'Catalogue key',
            type: 'string',
            description:
                'Stable booking identity. Use lower camel case and never rename this after the offering is published.',
            readOnly: ({ document }) => Boolean(document?._id && !document._id.startsWith('drafts.')),
            validation: (rule) =>
                rule
                    .required()
                    .regex(/^[a-z][a-zA-Z0-9]*$/, { name: 'lower camel case', invert: false })
                    .custom(isUniqueOfferingKey),
        }),
        defineField({
            name: 'name',
            title: 'Customer-facing name',
            type: 'string',
            validation: (rule) => rule.required(),
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
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'recipe',
            title: 'Staff recipe',
            type: 'reference',
            to: [{ type: 'birthdayPartyCreation' }],
            description: 'Optional reusable instructions shown to staff. This does not control customer presentation.',
        }),
        defineField({
            name: 'legacyLabels',
            title: 'Previous Paperform labels',
            type: 'array',
            description: 'Keep old submitted labels here so historical submissions can still be resolved.',
            of: [defineArrayMember({ type: 'string', validation: (rule) => rule.required() })],
            validation: (rule) => rule.unique(),
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
        select: { key: 'key', status: 'status', title: 'name' },
        prepare: ({ key, status, title }) => ({
            title,
            subtitle: [key, status === 'retired' ? 'Retired' : undefined].filter(Boolean).join(' · '),
        }),
    },
})
