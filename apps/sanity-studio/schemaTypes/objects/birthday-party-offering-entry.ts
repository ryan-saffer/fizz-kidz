import { defineArrayMember, defineField, defineType } from 'sanity'

import { BIRTHDAY_PARTY_BOOKING_CHANNELS } from '../birthday-party-catalogue-options'

export const birthdayPartyOfferingEntry = defineType({
    name: 'birthdayPartyOfferingEntry',
    title: 'Package creation offering',
    type: 'object',
    fields: [
        defineField({
            name: 'offering',
            title: 'Customer offering',
            type: 'reference',
            to: [{ type: 'birthdayPartyCreationOffering' }],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'availability',
            title: 'Booking channels',
            type: 'array',
            description: 'Choose every booking flow where customers may select this offering.',
            of: [
                defineArrayMember({
                    type: 'string',
                    options: {
                        list: BIRTHDAY_PARTY_BOOKING_CHANNELS.map((channel) => ({
                            title: channel === 'studio' ? 'Studio' : 'Mobile',
                            value: channel,
                        })),
                    },
                }),
            ],
            validation: (rule) => rule.required().min(1).unique(),
        }),
    ],
    preview: {
        select: {
            channels: 'availability',
            title: 'offering.name',
        },
        prepare: ({ channels, title }) => ({
            title: title ?? 'Missing offering',
            subtitle: Array.isArray(channels) ? channels.join(' + ') : undefined,
        }),
    },
})
