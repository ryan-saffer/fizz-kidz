import { ComposeSparklesIcon } from '@sanity/icons/ComposeSparkles'
import { defineArrayMember, defineField, defineType, type ValidationContext } from 'sanity'

import { BIRTHDAY_PARTY_BOOKING_CHANNELS, BIRTHDAY_PARTY_CATALOGUE_STATUSES } from '@fizz-kidz/core'

import { BirthdayPartyCreationOfferingInput } from '../../components/birthday-party-creation-offering-input'
import { hasValidCreationPackageRelationships } from '../birthday-party-catalogue-validation'

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
    title: 'Creation',
    type: 'document',
    icon: ComposeSparklesIcon,
    components: { input: BirthdayPartyCreationOfferingInput },
    initialValue: { status: 'active' },
    validation: (rule) => rule.custom(hasValidCreationPackageRelationships),
    fields: [
        defineField({
            name: 'key',
            title: 'Catalogue key',
            type: 'string',
            description:
                'Stable booking identity. Use lower camel case and never rename this after the creation is published.',
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
            name: 'image',
            title: 'Image',
            type: 'image',
            description:
                'Default image for a live creation. Package cards may use another image when their presentation differs. Archived historical creations do not need an image.',
            options: { hotspot: true },
            validation: (rule) =>
                rule.custom((image, context) =>
                    context.document?.status === 'active' && !image ? 'Live creations must have an image.' : true
                ),
        }),
        defineField({
            name: 'status',
            title: 'Status',
            type: 'string',
            options: {
                layout: 'radio',
                list: BIRTHDAY_PARTY_CATALOGUE_STATUSES.map((status) => ({
                    title: status === 'active' ? 'Live' : 'Archived',
                    value: status,
                })),
            },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'bookingChannels',
            title: 'Offered at',
            type: 'array',
            description:
                'Where this creation can be delivered operationally. Select Studio, Mobile, or both. Package cards inherit this availability.',
            hidden: ({ document }) => document?.status === 'retired',
            of: [defineArrayMember({ type: 'string' })],
            options: {
                layout: 'grid',
                list: BIRTHDAY_PARTY_BOOKING_CHANNELS.map((channel) => ({
                    title: channel === 'studio' ? 'Studio' : 'Mobile',
                    value: channel,
                })),
            },
            validation: (rule) =>
                rule.unique().custom((channels, context) => {
                    if (context.document?.status === 'active' && !channels?.length) {
                        return 'Live creations must be offered at Studio, Mobile, or both.'
                    }
                    return true
                }),
        }),
        defineField({
            name: 'creationInstructions',
            title: 'Creation instructions',
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
    ],
    preview: {
        select: { bookingChannels: 'bookingChannels', key: 'key', media: 'image', status: 'status', title: 'name' },
        prepare: ({ bookingChannels, key, media, status, title }) => ({
            title,
            subtitle: [
                key,
                status === 'retired'
                    ? 'Archived'
                    : Array.isArray(bookingChannels)
                      ? bookingChannels.map((channel) => (channel === 'studio' ? 'Studio' : 'Mobile')).join(' + ')
                      : undefined,
            ]
                .filter(Boolean)
                .join(' · '),
            media,
        }),
    },
})
