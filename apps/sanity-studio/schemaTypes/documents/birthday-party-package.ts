import { DocumentIcon } from '@sanity/icons/Document'
import { defineArrayMember, defineField, defineType } from 'sanity'

const colours = [
    { title: 'Pink', value: 'pink' },
    { title: 'Blue', value: 'blue' },
    { title: 'Yellow', value: 'yellow' },
    { title: 'Green', value: 'green' },
    { title: 'Purple', value: 'purple' },
]

export const birthdayPartyPackage = defineType({
    name: 'birthdayPartyPackage',
    title: 'Birthday Party packages',
    type: 'document',
    icon: DocumentIcon,
    fields: [
        defineField({
            name: 'name',
            title: 'Name',
            type: 'string',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'colour',
            title: 'Colour',
            type: 'string',
            options: { list: colours, layout: 'radio' },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'order',
            title: 'Display order',
            type: 'number',
            description: 'Packages with lower numbers appear first in the Portal.',
            validation: (rule) => rule.required().integer().min(0),
        }),
        defineField({
            name: 'creations',
            title: 'Creations',
            type: 'array',
            description: 'Drag creations into the order they should appear in the Portal.',
            of: [defineArrayMember({ type: 'reference', to: [{ type: 'birthdayPartyCreation' }] })],
            validation: (rule) => rule.required().min(1).unique(),
        }),
    ],
    preview: {
        select: { title: 'name', colour: 'colour', order: 'order' },
        prepare: ({ title, colour, order }) => ({ title, subtitle: `${order}: ${colour}` }),
    },
})
