import { ImageIcon } from '@sanity/icons/Image'
import { defineField, defineType } from 'sanity'

import { WEBSITE_IMAGE_CATEGORIES } from '../../website-image-categories'

const categories = WEBSITE_IMAGE_CATEGORIES.map((value) => ({ title: value, value }))

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
            description: 'Stable code identifier. Changing this will break the Website build.',
            readOnly: true,
            validation: (rule) => rule.required(),
        }),
    ],
    preview: {
        select: { title: 'title', category: 'category', media: 'image' },
        prepare: ({ title, category, media }) => ({ title, subtitle: category, media }),
    },
})
