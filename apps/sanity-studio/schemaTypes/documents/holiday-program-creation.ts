import { DocumentTextIcon } from '@sanity/icons/DocumentText'
import { defineField, defineType } from 'sanity'

export const holidayProgramCreation = defineType({
    name: 'holidayProgramCreation',
    title: 'Holiday Program creations',
    type: 'document',
    icon: DocumentTextIcon,
    initialValue: { status: 'live' },
    fields: [
        defineField({
            name: 'status',
            title: 'Status',
            type: 'string',
            options: {
                list: [
                    { title: 'Live', value: 'live' },
                    { title: 'Archived', value: 'archived' },
                ],
                layout: 'radio',
            },
            validation: (rule) => rule.required(),
        }),
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
        {
            title: 'Program date, newest first',
            name: 'dateDesc',
            by: [{ field: 'date', direction: 'desc' }],
        },
    ],
    preview: {
        select: { title: 'name', date: 'date', status: 'status' },
        prepare: ({ title, date, status }) => ({
            title,
            subtitle: `${status === 'archived' ? 'Archived' : 'Live'} · ${date}`,
        }),
    },
})
