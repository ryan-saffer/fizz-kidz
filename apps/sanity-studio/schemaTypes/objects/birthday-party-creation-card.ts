import { defineArrayMember, defineField, defineType } from 'sanity'

import { BIRTHDAY_PARTY_CARD_COLOURS } from '@fizz-kidz/core'

export const birthdayPartyCreationCard = defineType({
    name: 'birthdayPartyCreationCard',
    title: 'Creation card',
    type: 'object',
    fields: [
        defineField({
            name: 'creation',
            title: 'Creation',
            type: 'reference',
            description: 'The selectable creation represented by this Website card.',
            to: [{ type: 'birthdayPartyCreationOffering' }],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'image',
            title: 'Image override',
            type: 'image',
            description: 'Leave empty to use the creation image.',
            options: { hotspot: true },
        }),
        defineField({
            name: 'alt',
            title: 'Image description override',
            type: 'string',
            description: 'Leave empty to use the creation name. Otherwise describe the image for assistive technology.',
        }),
        defineField({
            name: 'label',
            title: 'Label override',
            type: 'array',
            description: 'Leave empty to use the creation name. Add multiple items to control line breaks.',
            hidden: ({ parent }) => Boolean(parent?.hideLabel),
            of: [defineArrayMember({ type: 'string', validation: (rule) => rule.required() })],
        }),
        defineField({
            name: 'hideLabel',
            title: 'Hide the card label',
            type: 'boolean',
            description: 'Use for deliberate image-only sequences such as Fluid Bears.',
            initialValue: false,
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
            name: 'bookingOrder',
            title: 'Legacy booking choice order',
            type: 'number',
            deprecated: { reason: 'Booking menus now follow Website card order.' },
            hidden: true,
            readOnly: true,
        }),
    ],
    preview: {
        select: {
            creation: 'creation.name',
            creationImage: 'creation.image',
            hideLabel: 'hideLabel',
            labels: 'label',
            media: 'image',
        },
        prepare: ({ creation, creationImage, hideLabel, labels, media }) => {
            const title = hideLabel
                ? 'Image-only card'
                : Array.isArray(labels) && labels.length > 0
                  ? labels.join(' / ')
                  : creation
            return {
                title: title ?? 'Untitled card',
                subtitle: creation,
                media: media ?? creationImage,
            }
        },
    },
})
