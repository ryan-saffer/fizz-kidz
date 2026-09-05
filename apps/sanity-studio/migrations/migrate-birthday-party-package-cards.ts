import { deepStrictEqual, strictEqual } from 'node:assert'
import { isDeepStrictEqual } from 'node:util'

import { getCliClient } from 'sanity/cli'

import { BIRTHDAY_PARTY_BOOKING_CHANNELS } from '@fizz-kidz/core'

import { birthdayPartyCataloguePackages } from './birthday-party-catalogue-source'

const API_VERSION = '2026-08-01'
const MIGRATION_SOURCE = 'website-catalogue-phase-1-2026-09'
const apply = process.argv.includes('--apply')
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ perspective: 'raw', useCdn: false })

type Reference = {
    _ref?: string
    _type?: string
    [key: string]: unknown
}

type OfferingEntry = {
    availability?: string[]
    offering?: Reference
}

type WebsiteCard = {
    _key?: string
    alt?: string
    bookingChannels?: string[]
    bookingOrder?: number
    creation?: Reference
    hideLabel?: boolean
    image?: Record<string, unknown>
    label?: string[]
    offering?: Reference
    useForBookingChoice?: boolean
}

type PackageDraft = {
    _id: string
    key?: string
    offeringEntries?: OfferingEntry[]
    websiteCards?: WebsiteCard[]
}

function cardPath(cardKey: string, field: string) {
    return `websiteCards[_key==${JSON.stringify(cardKey)}].${field}`
}

const [packageDrafts, creationDrafts] = await Promise.all([
    client.fetch<PackageDraft[]>(
        `*[
            _type == "birthdayPartyPackage" &&
            _id in path("drafts.**") &&
            migrationSource == $migrationSource
        ] | order(coalesce(position, catalogueOrder) asc) {
            _id,
            key,
            offeringEntries,
            websiteCards
        }`,
        { migrationSource: MIGRATION_SOURCE }
    ),
    client.fetch<Array<{ _id: string; image?: Record<string, unknown>; key: string; name: string }>>(
        `*[
            _type == "birthdayPartyCreationOffering" &&
            _id in path("drafts.**") &&
            migrationSource == $migrationSource
        ]{_id, image, key, name}`,
        { migrationSource: MIGRATION_SOURCE }
    ),
])

const creationKeyById = new Map(
    creationDrafts.flatMap((creation) => [
        [creation._id, creation.key] as const,
        [creation._id.replace(/^drafts\./, ''), creation.key] as const,
    ])
)
const creationById = new Map(
    creationDrafts.flatMap((creation) => [
        [creation._id, creation] as const,
        [creation._id.replace(/^drafts\./, ''), creation] as const,
    ])
)

strictEqual(packageDrafts.length, birthdayPartyCataloguePackages.length)
deepStrictEqual(
    packageDrafts.map((partyPackage) => partyPackage.key),
    birthdayPartyCataloguePackages.map((partyPackage) => partyPackage.key)
)

const patches = packageDrafts.flatMap((partyPackage) => {
    const sourcePackage = birthdayPartyCataloguePackages.find((candidate) => candidate.key === partyPackage.key)
    if (!sourcePackage) throw new Error(`Unknown migration package "${partyPackage.key}".`)
    const bookingOrderByCreationKey = new Map<string, number>(
        sourcePackage.offerings.map((packageOffering, index) => [packageOffering.offeringKey, index + 1])
    )
    const availabilityByCreationId = new Map<string, string[]>()
    for (const entry of partyPackage.offeringEntries ?? []) {
        const creationId = entry.offering?._ref
        if (!creationId) throw new Error(`Package "${partyPackage.key}" contains a creation entry without a reference.`)
        if (availabilityByCreationId.has(creationId)) {
            throw new Error(`Package "${partyPackage.key}" contains duplicate creation entries for "${creationId}".`)
        }
        availabilityByCreationId.set(creationId, entry.availability ?? [])
    }

    const bookingCardCounts = new Map<string, number>()
    const bookingOrders = new Set<number>()
    const set: Record<string, unknown> = {}
    const unset: string[] = []

    for (const card of partyPackage.websiteCards ?? []) {
        if (!card._key) throw new Error(`Package "${partyPackage.key}" contains a Website card without a key.`)
        if (card.creation?._ref && card.offering?._ref && card.creation._ref !== card.offering._ref) {
            throw new Error(`Package "${partyPackage.key}" card "${card._key}" has conflicting creation references.`)
        }

        const creation = card.creation ?? card.offering
        const creationId = creation?._ref
        if (!creationId) {
            throw new Error(`Package "${partyPackage.key}" card "${card._key}" has no creation reference.`)
        }
        const creationDocument = creationById.get(creationId)
        if (!creationDocument) {
            throw new Error(`Package "${partyPackage.key}" card "${card._key}" references an unknown creation.`)
        }

        const bookingChannels =
            card.bookingChannels ?? (card.useForBookingChoice ? availabilityByCreationId.get(creationId) : [])
        if (!bookingChannels) {
            throw new Error(`Package "${partyPackage.key}" card "${card._key}" has no booking-channel source.`)
        }
        if (
            new Set(bookingChannels).size !== bookingChannels.length ||
            bookingChannels.some(
                (channel) =>
                    !BIRTHDAY_PARTY_BOOKING_CHANNELS.includes(
                        channel as (typeof BIRTHDAY_PARTY_BOOKING_CHANNELS)[number]
                    )
            )
        ) {
            throw new Error(`Package "${partyPackage.key}" card "${card._key}" has invalid booking channels.`)
        }

        if (bookingChannels.length > 0) {
            bookingCardCounts.set(creationId, (bookingCardCounts.get(creationId) ?? 0) + 1)
            if (!card.bookingChannels) set[cardPath(card._key, 'bookingChannels')] = bookingChannels
            const creationKey = creationKeyById.get(creationId)
            const bookingOrder = card.bookingOrder ?? bookingOrderByCreationKey.get(creationKey ?? '')
            if (!Number.isInteger(bookingOrder) || (bookingOrder ?? 0) < 1) {
                throw new Error(`Package "${partyPackage.key}" card "${card._key}" has no booking-order source.`)
            }
            if (bookingOrders.has(bookingOrder!)) {
                throw new Error(`Package "${partyPackage.key}" has duplicate booking order "${bookingOrder}".`)
            }
            bookingOrders.add(bookingOrder!)
            if (card.bookingOrder === undefined) set[cardPath(card._key, 'bookingOrder')] = bookingOrder
        } else if (card.bookingOrder !== undefined) {
            unset.push(cardPath(card._key, 'bookingOrder'))
        }
        if (!card.creation) set[cardPath(card._key, 'creation')] = creation
        if (card.image && creationDocument.image && isDeepStrictEqual(card.image, creationDocument.image)) {
            unset.push(cardPath(card._key, 'image'))
        }
        if (card.alt === `${creationDocument.name} creation`) unset.push(cardPath(card._key, 'alt'))
        if (card.label?.length === 0) {
            if (card.hideLabel !== true) set[cardPath(card._key, 'hideLabel')] = true
            unset.push(cardPath(card._key, 'label'))
        } else if (isDeepStrictEqual(card.label, [creationDocument.name])) {
            unset.push(cardPath(card._key, 'label'))
        }
        if (card.offering) unset.push(cardPath(card._key, 'offering'))
        if (card.useForBookingChoice !== undefined) unset.push(cardPath(card._key, 'useForBookingChoice'))
    }

    const creationIds = new Set(
        (partyPackage.websiteCards ?? []).flatMap((card) => {
            const creationId = card.creation?._ref ?? card.offering?._ref
            return creationId ? [creationId] : []
        })
    )
    for (const creationId of creationIds) {
        if (bookingCardCounts.get(creationId) !== 1) {
            throw new Error(
                `Package "${partyPackage.key}" creation "${creationId}" must have exactly one booking card.`
            )
        }
    }
    if (
        bookingOrders.size !== creationIds.size ||
        !Array.from(bookingOrders).every((order) => order <= creationIds.size)
    ) {
        throw new Error(`Package "${partyPackage.key}" booking orders must be consecutive from 1.`)
    }

    if (partyPackage.offeringEntries != null) unset.push('offeringEntries')
    return Object.keys(set).length > 0 || unset.length > 0 ? [{ documentId: partyPackage._id, set, unset }] : []
})

console.log(`${patches.length} package drafts need the single-card model${apply ? ' and will be migrated' : ''}.`)
if (!apply) {
    console.log(
        patches.length > 0
            ? 'No documents changed. Run again with --apply to migrate only the affected card fields.'
            : 'No documents changed.'
    )
    process.exit(0)
}
if (patches.length === 0) {
    console.log('No documents changed.')
    process.exit(0)
}

let transaction = client.transaction()
for (const patch of patches) {
    transaction = transaction.patch(patch.documentId, (builder) => builder.set(patch.set).unset(patch.unset))
}
const result = await transaction.commit({ visibility: 'sync' })
console.log(`Migrated ${result.results.length} package drafts. No documents were published.`)
