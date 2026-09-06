import { DocumentIcon } from '@sanity/icons/Document'
import { defineArrayMember, defineField, defineType, type ValidationContext } from 'sanity'

const API_VERSION = '2026-08-01'
const RESERVED_SLUGS = ['at-home-parties', 'book-a-party', 'creations']

type SlugValue = { current?: string }

async function isValidWebsiteSlug(slug: SlugValue | undefined, context: ValidationContext) {
    if (!slug?.current) return true
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.current)) {
        return 'Use lowercase words separated by single hyphens.'
    }
    if (RESERVED_SLUGS.includes(slug.current)) return `"${slug.current}" is reserved by another Website page.`

    const documentId = context.document?._id?.replace(/^drafts\./, '')
    const result = await context.getClient({ apiVersion: API_VERSION }).fetch<{
        duplicateId: string | null
        publishedSlug: string | null
    }>(
        `{
            "duplicateId": *[
                _type == "birthdayPartyPackage" &&
                websitePage.slug.current == $slug &&
                !(_id in [$publishedId, $draftId])
            ][0]._id,
            "publishedSlug": *[_id == $publishedId][0].websitePage.slug.current
        }`,
        {
            draftId: documentId ? `drafts.${documentId}` : '',
            publishedId: documentId ?? '',
            slug: slug.current,
        }
    )

    if (result.publishedSlug && result.publishedSlug !== slug.current) {
        return `The published Website slug "${result.publishedSlug}" cannot be changed.`
    }
    return result.duplicateId ? `The Website slug "${slug.current}" is already in use.` : true
}

export const birthdayPartyWebsitePage = defineType({
    name: 'birthdayPartyWebsitePage',
    title: 'Website page',
    type: 'object',
    icon: DocumentIcon,
    fields: [
        defineField({
            name: 'slug',
            title: 'Page path',
            type: 'slug',
            description: 'Creates /birthday-parties/page-path/. This cannot change after publication.',
            options: { source: 'packageName' },
            validation: (rule) => rule.required().custom(isValidWebsiteSlug),
        }),
        defineField({
            name: 'seo',
            title: 'Search and sharing',
            type: 'object',
            fields: [
                defineField({
                    name: 'title',
                    title: 'Page title',
                    type: 'string',
                    validation: (rule) => rule.required(),
                }),
                defineField({
                    name: 'description',
                    title: 'Description',
                    type: 'text',
                    rows: 3,
                    validation: (rule) => rule.required(),
                }),
                defineField({
                    name: 'serviceName',
                    title: 'Structured-data service name',
                    type: 'string',
                    validation: (rule) => rule.required(),
                }),
            ],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'hero',
            title: 'Page introduction',
            type: 'object',
            fields: [
                defineField({ name: 'title', type: 'string', validation: (rule) => rule.required() }),
                defineField({ name: 'subtitle', type: 'string', validation: (rule) => rule.required() }),
                defineField({
                    name: 'description',
                    type: 'text',
                    rows: 4,
                    validation: (rule) => rule.required(),
                }),
                defineField({
                    name: 'theme',
                    title: 'Theme (deprecated)',
                    type: 'string',
                    deprecated: { reason: 'Use the package Primary colour.' },
                    hidden: true,
                    readOnly: true,
                }),
                defineField({
                    name: 'image',
                    type: 'image',
                    options: { hotspot: true },
                    validation: (rule) => rule.required(),
                }),
                defineField({
                    name: 'imageAlt',
                    title: 'Image description',
                    type: 'string',
                    validation: (rule) => rule.required(),
                }),
            ],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'creationsImage',
            title: 'Creations-section image',
            type: 'image',
            description:
                'Shown beside the creation cards unless the package hides this image. Use clean artwork without a baked-in New badge; the Website adds that badge automatically.',
            options: { hotspot: true },
            validation: (rule) =>
                rule.custom((image, context) =>
                    context.document?.hidePartyImage || image
                        ? true
                        : 'Add an image or enable “Hide the party image beside creations”.'
                ),
        }),
        defineField({
            name: 'creationsImageAlt',
            title: 'Creations-section image description (deprecated)',
            type: 'string',
            deprecated: { reason: 'The description is derived from Package name.' },
            hidden: true,
            readOnly: true,
        }),
        defineField({
            name: 'navigation',
            title: 'Website menu',
            type: 'object',
            initialValue: { isNew: false },
            fields: [
                defineField({
                    name: 'title',
                    title: 'Title (deprecated)',
                    type: 'string',
                    deprecated: { reason: 'The title is derived from Package name.' },
                    hidden: true,
                    readOnly: true,
                }),
                defineField({
                    name: 'order',
                    title: 'Website menu order (deprecated)',
                    type: 'number',
                    deprecated: { reason: 'Use the package Position field.' },
                    hidden: true,
                    readOnly: true,
                }),
                defineField({
                    name: 'isNew',
                    title: 'Show the New badge',
                    type: 'boolean',
                    description:
                        'Shows a New badge in the Website menu, on the Party Themes image, and on the creations-section image.',
                    validation: (rule) => rule.required(),
                }),
            ],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'themeCard',
            title: 'Party Themes card',
            type: 'object',
            fields: [
                defineField({
                    name: 'title',
                    title: 'Title (deprecated)',
                    type: 'string',
                    deprecated: { reason: 'The title is derived from Package name.' },
                    hidden: true,
                    readOnly: true,
                }),
                defineField({
                    name: 'order',
                    title: 'Party Themes order (deprecated)',
                    type: 'number',
                    deprecated: { reason: 'Use the package Position field.' },
                    hidden: true,
                    readOnly: true,
                }),
                defineField({
                    name: 'colour',
                    title: 'Accent colour (deprecated)',
                    type: 'string',
                    deprecated: { reason: 'Use the package Accent colour.' },
                    hidden: true,
                    readOnly: true,
                }),
                defineField({
                    name: 'image',
                    type: 'image',
                    description:
                        'Use clean artwork without a baked-in New badge; the Website adds that badge automatically.',
                    options: { hotspot: true },
                    validation: (rule) => rule.required(),
                }),
                defineField({
                    name: 'imageAlt',
                    title: 'Image description',
                    type: 'string',
                    validation: (rule) => rule.required(),
                }),
            ],
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'features',
            title: 'Feature sections',
            type: 'array',
            description: 'Optional package-specific sections shown after the creation cards.',
            of: [defineArrayMember({ type: 'birthdayPartyFeatureSection' })],
            initialValue: [],
            validation: (rule) => rule.required(),
        }),
    ],
    preview: {
        select: { media: 'hero.image', subtitle: 'slug.current', title: 'hero.title' },
        prepare: ({ media, subtitle, title }) => ({ title: title ?? 'Incomplete Website page', subtitle, media }),
    },
})
