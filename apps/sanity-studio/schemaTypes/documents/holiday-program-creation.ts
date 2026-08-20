import { DocumentTextIcon } from '@sanity/icons/DocumentText'
import { defineField, defineType } from 'sanity'

export const holidayProgramCreation = defineType({
    name: 'holidayProgramCreation',
    title: 'Holiday Program creations',
    type: 'document',
    icon: DocumentTextIcon,
    fields: [
        defineField({
            name: 'date',
            title: 'Program date',
            type: 'date',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'name',
            title: 'Name',
            type: 'string',
            description: 'The day and program names shown in the Portal accordion.',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'instructions',
            title: 'Instructions',
            type: 'creationInstructions',
            description: 'Use the toolbar for headings, lists, links, and images. No Markdown is required.',
            validation: (rule) => rule.required().min(1),
        }),
    ],
    orderings: [
        {
            title: 'Program date',
            name: 'dateAsc',
            by: [{ field: 'date', direction: 'asc' }],
        },
    ],
    preview: {
        select: { title: 'name', date: 'date' },
        prepare: ({ title, date }) => ({ title, subtitle: date }),
    },
})
