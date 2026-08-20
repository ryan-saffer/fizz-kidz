import { ClockIcon } from '@sanity/icons/Clock'
import { defineArrayMember, defineField, defineType } from 'sanity'

const titleColours = [
    { title: 'Blue', value: '#21C1EE' },
    { title: 'Orange', value: '#E66E26' },
    { title: 'Pink', value: '#ED1272' },
    { title: 'Purple', value: '#9044E2' },
    { title: 'Green', value: '#9ECC45' },
    { title: 'Yellow', value: '#FFD602' },
]

export const holidayProgramSession = defineType({
    name: 'holidayProgramSession',
    title: 'Holiday Program session',
    type: 'object',
    icon: ClockIcon,
    fields: [
        defineField({
            name: 'date',
            title: 'Date',
            type: 'date',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'slot',
            title: 'Time slot',
            type: 'string',
            options: {
                layout: 'radio',
                list: [
                    { title: 'Morning, 10:00am - 12:30pm', value: 'morning' },
                    { title: 'Afternoon, 1:30pm - 4:00pm', value: 'afternoon' },
                ],
            },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'title',
            title: 'Program title',
            type: 'string',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'creations',
            title: 'Creations',
            type: 'array',
            of: [defineArrayMember({ type: 'string' })],
            validation: (rule) => rule.required().length(3).unique(),
        }),
        defineField({
            name: 'image',
            title: 'Card image',
            type: 'image',
            options: { hotspot: true },
            fields: [
                defineField({
                    name: 'alt',
                    title: 'Alternative text',
                    type: 'string',
                    validation: (rule) => rule.required(),
                }),
            ],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'colour',
            title: 'Title colour',
            type: 'string',
            options: { list: titleColours },
            validation: (rule) => rule.required(),
        }),
    ],
    preview: {
        select: { title: 'title', date: 'date', slot: 'slot', media: 'image' },
        prepare: ({ title, date, slot, media }) => ({
            title,
            subtitle: [date, slot].filter(Boolean).join(' - '),
            media,
        }),
    },
})
