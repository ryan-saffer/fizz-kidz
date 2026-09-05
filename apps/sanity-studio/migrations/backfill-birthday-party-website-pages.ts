import { deepStrictEqual, strictEqual } from 'node:assert'

import { getCliClient } from 'sanity/cli'

import { birthdayPartyPageSource, type BirthdayPartyPageSource } from './birthday-party-page-source'

const API_VERSION = '2026-08-01'
const apply = process.argv.includes('--apply')
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ perspective: 'raw', useCdn: false })

type ImageDocument = {
    image?: Record<string, unknown>
    key: string
}

type PackageDocument = {
    _id: string
    _type: 'birthdayPartyPackage'
    key?: string
    websitePage?: unknown
    [key: string]: unknown
}

function oneBy<T>(items: T[], keyFor: (item: T) => string, description: string) {
    const result = new Map<string, T>()
    for (const item of items) {
        const key = keyFor(item)
        if (result.has(key)) throw new Error(`Duplicate ${description}: "${key}".`)
        result.set(key, item)
    }
    return result
}

const [images, publishedPackages, packageDrafts] = await Promise.all([
    client.fetch<ImageDocument[]>(`*[_type == "websiteImage" && !(_id in path("drafts.**"))]{key,image}`),
    client.fetch<PackageDocument[]>(
        `*[_type == "birthdayPartyPackage" && !(_id in path("drafts.**")) && status == "active"]`
    ),
    client.fetch<PackageDocument[]>(`*[_type == "birthdayPartyPackage" && _id in path("drafts.**")]`),
])

const imagesByKey = oneBy(images, (image) => image.key, 'published Website image key')
const packagesByKey = oneBy(publishedPackages, (partyPackage) => partyPackage.key ?? '', 'active package key')
const draftsByPublishedId = oneBy(
    packageDrafts,
    (partyPackage) => partyPackage._id.replace(/^drafts\./, ''),
    'package draft'
)

deepStrictEqual(new Set(packagesByKey.keys()), new Set(birthdayPartyPageSource.map((partyPackage) => partyPackage.key)))
strictEqual(packageDrafts.length, 0, 'Publish or discard existing package drafts before applying this backfill.')

function imageFor(key: string) {
    const image = imagesByKey.get(key)?.image
    if (!image) throw new Error(`Missing published Website image "${key}".`)
    return image
}

function websitePageFor(source: BirthdayPartyPageSource) {
    const { imageKey: heroImageKey, ...hero } = source.hero
    const { imageKey: themeCardImageKey, ...themeCard } = source.themeCard

    return {
        _type: 'birthdayPartyWebsitePage',
        slug: { _type: 'slug', current: source.slug },
        seo: source.seo,
        hero: { ...hero, image: imageFor(heroImageKey) },
        ...(source.creationsImageKey ? { creationsImage: imageFor(source.creationsImageKey) } : {}),
        navigation: source.navigation,
        themeCard: { ...themeCard, image: imageFor(themeCardImageKey) },
        features: (source.features ?? []).map((feature) => ({
            _key: feature.key,
            _type: 'birthdayPartyFeatureSection',
            description: feature.description,
            headingImage: imageFor(feature.headingImageKey),
            headingImageAlt: feature.headingImageAlt,
            cards: feature.cards.map((card, index) => ({
                _key: `${feature.key}_${index + 1}`,
                _type: 'birthdayPartyFeatureCard',
                colour: card.colour,
                image: imageFor(card.imageKey),
                imageAlt: card.imageAlt,
                label: card.label,
            })),
        })),
    }
}

const changes = (birthdayPartyPageSource as readonly BirthdayPartyPageSource[]).flatMap((source) => {
    const partyPackage = packagesByKey.get(source.key)
    if (!partyPackage) throw new Error(`Missing active package "${source.key}".`)
    if (draftsByPublishedId.has(partyPackage._id)) throw new Error(`Package "${source.key}" already has a draft.`)
    if (partyPackage.websitePage) return []

    return [
        {
            draft: {
                ...partyPackage,
                _id: `drafts.${partyPackage._id}`,
                websitePage: websitePageFor(source),
            } satisfies PackageDocument,
        },
    ]
})

console.log(`${changes.length} active package documents need Website page content.`)
if (!apply) {
    console.log(
        changes.length
            ? 'No documents changed. Run again with --apply to create review drafts.'
            : 'No documents changed.'
    )
    process.exit(0)
}
if (changes.length === 0) process.exit(0)

let transaction = client.transaction()
for (const { draft } of changes) transaction = transaction.createIfNotExists(draft)
const result = await transaction.commit({ visibility: 'sync' })
console.log(`Created ${result.results.length} package drafts with Website page content. Nothing was published.`)
