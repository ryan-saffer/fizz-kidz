import { ImageIcon } from '@sanity/icons/Image'
import { defineArrayMember, defineField, defineType } from 'sanity'

import { BIRTHDAY_PARTY_CARD_COLOURS } from '@fizz-kidz/core'

export const birthdayPartyFeatureCard = defineType({
    name: 'birthdayPartyFeatureCard',
    title: 'Feature card',
    type: 'object',
    icon: ImageIcon,
    fields: [
        defineField({
            name: 'image',
            title: 'Image',
            type: 'image',
            options: { hotspot: true },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'imageAlt',
            title: 'Image description',
            type: 'string',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'label',
            title: 'Label lines',
            type: 'array',
            description: 'Add multiple items to control line breaks.',
            of: [defineArrayMember({ type: 'string', validation: (rule) => rule.required() })],
            validation: (rule) => rule.required().min(1),
        }),
        defineField({
            name: 'colour',
            title: 'Accent colour',
            type: 'string',
            options: {
                layout: 'radio',
                list: BIRTHDAY_PARTY_CARD_COLOURS.map((colour) => ({
                    title: colour[0].toUpperCase() + colour.slice(1),
                    value: colour,
                })),
            },
            validation: (rule) => rule.required(),
        }),
    ],
    preview: {
        select: { labels: 'label', media: 'image' },
        prepare: ({ labels, media }) => ({
            title: Array.isArray(labels) ? labels.join(' / ') : 'Untitled feature card',
            media,
        }),
    },
})
