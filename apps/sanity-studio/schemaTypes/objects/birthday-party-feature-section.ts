import { ComposeSparklesIcon } from '@sanity/icons/ComposeSparkles'
import { defineArrayMember, defineField, defineType } from 'sanity'

type FeatureSectionValue = {
    headingImage?: unknown
    title?: string
}

function hasHeading(value: FeatureSectionValue | undefined) {
    return value?.title?.trim() || value?.headingImage ? true : 'Add a title or heading image.'
}

export const birthdayPartyFeatureSection = defineType({
    name: 'birthdayPartyFeatureSection',
    title: 'Feature section',
    type: 'object',
    icon: ComposeSparklesIcon,
    validation: (rule) => rule.custom((value) => hasHeading(value as FeatureSectionValue | undefined)),
    fields: [
        defineField({
            name: 'title',
            title: 'Title',
            type: 'string',
            description: 'Use a title or a heading image below.',
        }),
        defineField({
            name: 'headingImage',
            title: 'Heading image',
            type: 'image',
            description: 'Optional branded heading used instead of text.',
            options: { hotspot: true },
        }),
        defineField({
            name: 'headingImageAlt',
            title: 'Heading image description',
            type: 'string',
            hidden: ({ parent }) => !parent?.headingImage,
            validation: (rule) =>
                rule.custom((description, context) => {
                    const parent = context.parent as FeatureSectionValue | undefined
                    return parent?.headingImage && !description?.trim()
                        ? 'Describe the heading image for assistive technology.'
                        : true
                }),
        }),
        defineField({
            name: 'description',
            title: 'Description',
            type: 'text',
            rows: 4,
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'cards',
            title: 'Cards',
            type: 'array',
            of: [defineArrayMember({ type: 'birthdayPartyFeatureCard' })],
            validation: (rule) => rule.required().min(1),
        }),
    ],
    preview: {
        select: { media: 'headingImage', title: 'title' },
        prepare: ({ media, title }) => ({ title: title ?? 'Image-heading feature', media }),
    },
})
