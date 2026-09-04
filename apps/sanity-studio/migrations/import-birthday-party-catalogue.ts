import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

import { getCliClient } from 'sanity/cli'

import {
    birthdayPartyCatalogueOfferings,
    birthdayPartyCataloguePackages,
    type CatalogueSourceOffering,
} from './birthday-party-catalogue-source'

const API_VERSION = '2026-08-01'
const MIGRATION_SOURCE = 'website-catalogue-phase-1-2026-09'
const apply = process.argv.includes('--apply')
const applyImages = process.argv.includes('--apply-images')
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ perspective: 'raw' })

if (apply && applyImages) throw new Error('Choose either --apply or --apply-images, not both.')

type SanityDocument = {
    _id: string
    _type: string
    migrationSource?: string
    [key: string]: unknown
}

type ImageDocument = SanityDocument & {
    image?: Record<string, unknown>
    key: string
}

type RecipeDocument = SanityDocument & {
    name: string
}

function publishedId(documentId: string) {
    return documentId.replace(/^drafts\./, '')
}

function oneBy<T>(items: T[], describe: (item: T) => string, kind: string) {
    const result = new Map<string, T>()
    for (const item of items) {
        const key = describe(item)
        if (result.has(key)) throw new Error(`Duplicate ${kind}: "${key}"`)
        result.set(key, item)
    }
    return result
}

function migrationOwned(document: SanityDocument) {
    return document.migrationSource === MIGRATION_SOURCE
}

function draftCreationReference(offering: SanityDocument) {
    return {
        _ref: publishedId(offering._id),
        _strengthenOnPublish: { type: 'birthdayPartyCreationOffering' },
        _type: 'reference',
        _weak: true,
    }
}

const [imageDocuments, recipeDocuments, packageDocuments, packageDrafts, existingOfferings] = await Promise.all([
    client.fetch<ImageDocument[]>(
        `*[_type == "websiteImage" && category == "Creations" && !(_id in path("drafts.**"))]{_id,_type,key,image}`
    ),
    client.fetch<RecipeDocument[]>(
        `*[_type == "birthdayPartyCreation" && !(_id in path("drafts.**"))]{_id,_type,name}`
    ),
    client.fetch<SanityDocument[]>(`*[_type == "birthdayPartyPackage" && !(_id in path("drafts.**"))]`),
    client.fetch<SanityDocument[]>(`*[_type == "birthdayPartyPackage" && _id in path("drafts.**")]`),
    client.fetch<SanityDocument[]>(`*[_type == "birthdayPartyCreationOffering"]`),
])

const imagesByKey = oneBy(imageDocuments, (image) => image.key, 'published Website image key')
const recipesByName = oneBy(recipeDocuments, (recipe) => recipe.name, 'published creation instructions name')
const packagesByName = oneBy(
    packageDocuments,
    (partyPackage) => String(partyPackage.name),
    'published staff package name'
)
const imageKeysByOfferingKey = new Map<string, string>()
for (const sourcePackage of birthdayPartyCataloguePackages) {
    for (const packageOffering of sourcePackage.offerings) {
        const bookingChoiceCards = packageOffering.cards.filter((card) => card.useForBookingChoice)
        if (bookingChoiceCards.length !== 1) {
            throw new Error(
                `Package "${sourcePackage.key}" offering "${packageOffering.offeringKey}" must have exactly one booking choice image.`
            )
        }
        if (!imageKeysByOfferingKey.has(packageOffering.offeringKey)) {
            imageKeysByOfferingKey.set(packageOffering.offeringKey, bookingChoiceCards[0].imageKey)
        }
    }
}
const packageDraftsByPublishedId = oneBy(
    packageDrafts,
    (partyPackage) => publishedId(partyPackage._id),
    'package draft'
)

const existingOfferingsByKey = new Map<string, SanityDocument[]>()
for (const offering of existingOfferings) {
    const key = String(offering.key)
    existingOfferingsByKey.set(key, [...(existingOfferingsByKey.get(key) ?? []), offering])
}

const desiredOfferingDocuments = new Map<string, SanityDocument>()
const sourceOfferings: Record<string, CatalogueSourceOffering> = birthdayPartyCatalogueOfferings
for (const [key, sourceOffering] of Object.entries(sourceOfferings)) {
    const existingDocuments = existingOfferingsByKey.get(key) ?? []
    const documentIds = new Set(existingDocuments.map((document) => publishedId(document._id)))
    if (documentIds.size > 1) {
        throw new Error(`Offering key "${key}" belongs to more than one document.`)
    }
    if (existingDocuments.some((document) => !migrationOwned(document))) {
        throw new Error(`Offering key "${key}" already exists outside this migration; review it manually.`)
    }

    const documentId = documentIds.values().next().value ?? randomUUID()
    const recipe = sourceOffering.recipeName ? recipesByName.get(sourceOffering.recipeName) : undefined
    if (sourceOffering.recipeName && !recipe) {
        throw new Error(`Missing published creation instructions "${sourceOffering.recipeName}" for offering "${key}".`)
    }
    const imageKey = imageKeysByOfferingKey.get(key)
    const websiteImage = imageKey ? imagesByKey.get(imageKey) : undefined
    if (!imageKey || !websiteImage?.image) {
        throw new Error(`Missing published Creation image for offering "${key}".`)
    }

    desiredOfferingDocuments.set(key, {
        _id: `drafts.${documentId}`,
        _type: 'birthdayPartyCreationOffering',
        image: websiteImage.image,
        key,
        legacyLabels: sourceOffering.legacyLabels ?? [],
        migrationSource: MIGRATION_SOURCE,
        name: sourceOffering.name,
        ...(recipe ? { recipe: { _ref: recipe._id, _type: 'reference' } } : {}),
        status: 'active',
    })
}

const desiredPackageDocuments = birthdayPartyCataloguePackages.map((sourcePackage) => {
    const publishedPackage = packagesByName.get(sourcePackage.staffPackageName)
    if (!publishedPackage) {
        throw new Error(`Missing published staff package "${sourcePackage.staffPackageName}".`)
    }

    const existingDraft = packageDraftsByPublishedId.get(publishedPackage._id)
    if (existingDraft && !migrationOwned(existingDraft)) {
        throw new Error(
            `Package "${sourcePackage.staffPackageName}" has an existing manual draft. Publish or discard it before applying this migration.`
        )
    }

    const sourceCards = sourcePackage.offerings.flatMap((packageOffering) =>
        packageOffering.cards.map((sourceCard, cardIndex) => ({
            availability: packageOffering.availability,
            cardIndex,
            offeringKey: packageOffering.offeringKey,
            sourceCard,
        }))
    )
    const sourceCardsByImageKey = oneBy(
        sourceCards,
        ({ sourceCard }) => sourceCard.imageKey,
        `Website card image key in package "${sourcePackage.key}"`
    )
    const orderedSourceCards = sourcePackage.websiteCardOrder
        ? sourcePackage.websiteCardOrder.map((imageKey) => {
              const sourceCard = sourceCardsByImageKey.get(imageKey)
              if (!sourceCard) {
                  throw new Error(`Unknown Website card image key "${imageKey}" in package "${sourcePackage.key}".`)
              }
              return sourceCard
          })
        : sourceCards
    if (sourcePackage.websiteCardOrder && new Set(sourcePackage.websiteCardOrder).size !== orderedSourceCards.length) {
        throw new Error(`Package "${sourcePackage.key}" Website card order contains duplicate image keys.`)
    }
    if (orderedSourceCards.length !== sourceCards.length) {
        throw new Error(`Package "${sourcePackage.key}" Website card order is incomplete.`)
    }
    const bookingOrderByOfferingKey = new Map(
        sourcePackage.offerings.map((packageOffering, index) => [packageOffering.offeringKey, index + 1])
    )

    return {
        ...publishedPackage,
        _id: `drafts.${publishedPackage._id}`,
        accentColour: sourcePackage.accentColour,
        blackBackground: sourcePackage.blackBackground ?? false,
        caption: sourcePackage.caption,
        catalogueOrder: sourcePackage.catalogueOrder,
        customerName: sourcePackage.customerName,
        hidePartyImage: sourcePackage.hidePartyImage ?? false,
        key: sourcePackage.key,
        migrationSource: MIGRATION_SOURCE,
        status: 'active',
        summaryTitle: sourcePackage.summaryTitle,
        websiteCards: orderedSourceCards.map(({ availability, cardIndex, offeringKey, sourceCard }) => {
            const websiteImage = imagesByKey.get(sourceCard.imageKey)
            if (!websiteImage?.image) {
                throw new Error(
                    `Missing published Creation image "${sourceCard.imageKey}" for package "${sourcePackage.key}".`
                )
            }
            const offering = desiredOfferingDocuments.get(offeringKey)
            if (!offering) throw new Error(`Unknown offering key "${offeringKey}".`)
            const creationName = sourceOfferings[offeringKey].name

            return {
                _key: `card_${offeringKey}_${cardIndex + 1}`,
                _type: 'birthdayPartyCreationCard',
                ...(sourceCard.alt === `${creationName} creation` ? {} : { alt: sourceCard.alt }),
                ...(sourceCard.useForBookingChoice
                    ? {
                          bookingChannels: availability,
                          bookingOrder: bookingOrderByOfferingKey.get(offeringKey),
                      }
                    : {}),
                colour: sourceCard.colour,
                creation: draftCreationReference(offering),
                ...(sourceCard.label.length === 0 ? { hideLabel: true } : {}),
                ...(isDeepStrictEqual(websiteImage.image, offering.image) ? {} : { image: websiteImage.image }),
                ...(isDeepStrictEqual(sourceCard.label, [creationName]) || sourceCard.label.length === 0
                    ? {}
                    : { label: sourceCard.label }),
            }
        }),
    }
})

console.log(
    `${apply ? 'Applying' : applyImages ? 'Applying images to' : 'Dry run for'} ${desiredOfferingDocuments.size} creation drafts${applyImages ? '' : ` and ${desiredPackageDocuments.length} package drafts`}.`
)
console.log(`Found ${existingOfferings.length} existing offering documents and ${packageDrafts.length} package drafts.`)

if (!apply && !applyImages) {
    console.log('No documents changed. Run again with --apply after reviewing the source inventory.')
    process.exit(0)
}

let transaction = client.transaction()
if (applyImages) {
    if (existingOfferings.length !== desiredOfferingDocuments.size) {
        throw new Error('Creation image updates require every migration-owned creation draft to exist first.')
    }
    for (const offering of desiredOfferingDocuments.values()) {
        transaction = transaction.patch(offering._id, (patch) => patch.setIfMissing({ image: offering.image }))
    }
} else {
    for (const offering of desiredOfferingDocuments.values()) transaction = transaction.createOrReplace(offering)
    for (const partyPackage of desiredPackageDocuments) transaction = transaction.createOrReplace(partyPackage)
}

const result = await transaction.commit({ visibility: 'sync' })
console.log(
    `${applyImages ? 'Filled missing images on' : 'Created or replaced'} ${result.results.length} drafts. No documents were published.`
)
