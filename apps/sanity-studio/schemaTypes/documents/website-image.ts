import { ImageIcon } from '@sanity/icons/Image'
import { defineField, defineType, type ValidationContext } from 'sanity'

import { WEBSITE_IMAGE_CATEGORIES } from '../../website-image-categories'

const categories = WEBSITE_IMAGE_CATEGORIES.map((value) => ({ title: value, value }))

async function validateWebsiteKey(key: string | undefined, context: ValidationContext) {
    if (!key) return true

    const documentId = context.document?._id?.replace(/^drafts\./, '')
    const result = await context
        .getClient({ apiVersion: '2026-08-01' })
        .withConfig({ perspective: 'raw', useCdn: false })
        .fetch<{ duplicateId: string | null; publishedKey: string | null }>(
            `{
                "duplicateId": *[
                    _type == "websiteImage" &&
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
        return `The published Website key "${result.publishedKey}" cannot be changed.`
    }
    return result.duplicateId ? `The Website key "${key}" is already in use.` : true
}

export const websiteImage = defineType({
    name: 'websiteImage',
    title: 'Website image',
    type: 'document',
    icon: ImageIcon,
    fields: [
        defineField({
            name: 'title',
            title: 'Title',
            type: 'string',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'category',
            title: 'Category',
            type: 'string',
            options: { list: categories },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'image',
            title: 'Image',
            type: 'image',
            options: { hotspot: true },
            fields: [
                defineField({
                    name: 'bulkReplacementId',
                    title: 'Bulk replacement ID',
                    type: 'string',
                    hidden: true,
                    readOnly: true,
                }),
            ],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'key',
            title: 'Website key',
            type: 'string',
            description:
                'Unique identifier used by Website code. Set this before first publishing; published keys cannot be changed.',
            readOnly: ({ document }) => Boolean(document?._id && !document._id.startsWith('drafts.')),
            validation: (rule) => rule.required().custom(validateWebsiteKey),
        }),
    ],
    preview: {
        select: { title: 'title', category: 'category', media: 'image' },
        prepare: ({ title, category, media }) => ({ title, subtitle: category, media }),
    },
})
