import { defineArrayMember, defineField, defineType } from 'sanity'

import { BIRTHDAY_PARTY_CARD_COLOURS } from '../birthday-party-catalogue-options'

export const birthdayPartyCreationCard = defineType({
    name: 'birthdayPartyCreationCard',
    title: 'Creation card',
    type: 'object',
    fields: [
        defineField({
            name: 'offering',
            title: 'Customer offering',
            type: 'reference',
            description: 'The selectable offering represented by this Website card.',
            to: [{ type: 'birthdayPartyCreationOffering' }],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'image',
            title: 'Image',
            type: 'image',
            options: { hotspot: true },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'alt',
            title: 'Image description',
            type: 'string',
            description: 'Describe the creation shown in the image for people using assistive technology.',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'label',
            title: 'Card label lines',
            type: 'array',
            description: 'Usually one line. Leave empty only for a deliberate image sequence such as Fluid Bears.',
            of: [defineArrayMember({ type: 'string', validation: (rule) => rule.required() })],
        }),
        defineField({
            name: 'colour',
            title: 'Card colour',
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
        defineField({
            name: 'useForBookingChoice',
            title: 'Use this image for the booking choice',
            type: 'boolean',
            description: 'Exactly one card per offering must supply the Paperform choice image.',
            initialValue: false,
            validation: (rule) => rule.required(),
        }),
    ],
    preview: {
        select: { labels: 'label', media: 'image', offering: 'offering.name' },
        prepare: ({ labels, media, offering }) => ({
            title: Array.isArray(labels) && labels.length > 0 ? labels.join(' / ') : 'Image-only card',
            subtitle: offering,
            media,
        }),
    },
})
