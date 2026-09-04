import { defineArrayMember, defineField, defineType } from 'sanity'

import { BIRTHDAY_PARTY_BOOKING_CHANNELS, BIRTHDAY_PARTY_CARD_COLOURS } from '../birthday-party-catalogue-options'

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
            name: 'bookingChannels',
            title: 'Booking channels',
            type: 'array',
            description:
                'Select channels on exactly one card for each creation. Leave empty on additional presentation cards.',
            of: [defineArrayMember({ type: 'string' })],
            options: {
                layout: 'grid',
                list: BIRTHDAY_PARTY_BOOKING_CHANNELS.map((channel) => ({
                    title: channel === 'studio' ? 'Studio' : 'Mobile',
                    value: channel,
                })),
            },
            validation: (rule) => rule.unique(),
        }),
        defineField({
            name: 'bookingOrder',
            title: 'Booking choice order',
            type: 'number',
            description: 'Controls Paperform and booking-menu order without changing the Website card order.',
            hidden: ({ parent, value }) =>
                (!Array.isArray(parent?.bookingChannels) || parent.bookingChannels.length === 0) && value === undefined,
            validation: (rule) =>
                rule
                    .integer()
                    .min(1)
                    .custom((order, context) => {
                        const parent = context.parent as { bookingChannels?: string[] } | undefined
                        if (parent?.bookingChannels?.length && order === undefined) {
                            return 'A booking card must have a booking choice order.'
                        }
                        if (!parent?.bookingChannels?.length && order !== undefined) {
                            return 'Remove the booking choice order from an additional display card.'
                        }
                        return true
                    }),
        }),
    ],
    preview: {
        select: {
            bookingChannels: 'bookingChannels',
            bookingOrder: 'bookingOrder',
            creation: 'creation.name',
            creationImage: 'creation.image',
            hideLabel: 'hideLabel',
            labels: 'label',
            media: 'image',
        },
        prepare: ({ bookingChannels, bookingOrder, creation, creationImage, hideLabel, labels, media }) => {
            const title = hideLabel
                ? 'Image-only card'
                : Array.isArray(labels) && labels.length > 0
                  ? labels.join(' / ')
                  : creation
            const channels = Array.isArray(bookingChannels) ? bookingChannels.join(' + ') : ''
            return {
                title: title ?? 'Untitled card',
                subtitle: [
                    creation,
                    channels ? `Booking choice ${bookingOrder ?? '?'}: ${channels}` : 'Additional display card',
                ]
                    .filter(Boolean)
                    .join(' · '),
                media: media ?? creationImage,
            }
        },
    },
})
