import { DocumentTextIcon } from '@sanity/icons/DocumentText'
import { defineField, defineType } from 'sanity'

export const birthdayPartyCreation = defineType({
    name: 'birthdayPartyCreation',
    title: 'Birthday Party creations',
    type: 'document',
    icon: DocumentTextIcon,
    fields: [
        defineField({
            name: 'name',
            title: 'Name',
            type: 'string',
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
    preview: {
        select: { title: 'name' },
    },
})
