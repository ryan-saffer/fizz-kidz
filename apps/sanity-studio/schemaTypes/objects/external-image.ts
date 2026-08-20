import { ImageIcon } from '@sanity/icons/Image'
import { defineField, defineType } from 'sanity'

export const externalImage = defineType({
    name: 'externalImage',
    title: 'Imported image',
    type: 'object',
    icon: ImageIcon,
    fields: [
        defineField({
            name: 'url',
            title: 'Image URL',
            type: 'url',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'alt',
            title: 'Alternative text',
            type: 'string',
            description: 'Describe the image for people using screen readers.',
        }),
    ],
    preview: {
        select: { title: 'alt', subtitle: 'url' },
        prepare: ({ title, subtitle }) => ({ title: title || 'Imported image', subtitle }),
    },
})
