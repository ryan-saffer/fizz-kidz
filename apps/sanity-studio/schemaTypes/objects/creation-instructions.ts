import { RemoveIcon } from '@sanity/icons/Remove'
import { defineArrayMember, defineField, defineType } from 'sanity'

import { InstructionsInput } from '../../components/instructions-input'

export const creationInstructions = defineType({
    name: 'creationInstructions',
    title: 'Creation instructions',
    type: 'array',
    components: { input: InstructionsInput },
    of: [
        defineArrayMember({
            type: 'block',
            styles: [
                { title: 'Paragraph', value: 'normal' },
                { title: 'Session heading', value: 'h2' },
                { title: 'Creation heading', value: 'h3' },
                { title: 'Callout', value: 'blockquote' },
            ],
            lists: [
                { title: 'Bulleted list', value: 'bullet' },
                { title: 'Numbered list', value: 'number' },
            ],
            marks: {
                decorators: [
                    { title: 'Bold', value: 'strong' },
                    { title: 'Italic', value: 'em' },
                ],
                annotations: [
                    defineArrayMember({
                        name: 'link',
                        title: 'Link',
                        type: 'object',
                        fields: [
                            defineField({
                                name: 'href',
                                title: 'URL',
                                type: 'url',
                                validation: (rule) =>
                                    rule.uri({ scheme: ['http', 'https', 'mailto', 'tel'] }).required(),
                            }),
                        ],
                    }),
                ],
            },
        }),
        defineArrayMember({
            type: 'image',
            title: 'Image',
            options: { hotspot: true },
            fields: [
                defineField({
                    name: 'alt',
                    title: 'Alternative text',
                    type: 'string',
                    validation: (rule) => rule.required(),
                }),
            ],
        }),
        defineArrayMember({ type: 'externalImage' }),
        defineArrayMember({
            name: 'divider',
            title: 'Divider',
            type: 'object',
            icon: RemoveIcon,
            fields: [
                defineField({
                    name: 'style',
                    type: 'string',
                    initialValue: 'line',
                    hidden: true,
                }),
            ],
            preview: {
                prepare: () => ({ title: 'Divider' }),
            },
        }),
    ],
})
