import { BIRTHDAY_PARTY_BOOKING_CHANNELS } from '@fizz-kidz/core'

import type { SanityDocument, ValidationContext } from 'sanity'

const API_VERSION = '2026-08-01'

type CreationValue = {
    _id?: string
    bookingChannels?: string[]
    key?: string
    legacyLabels?: string[]
    name?: string
    status?: string
}

type CreationReference = {
    _ref?: string
}

type PackageValue = {
    key?: string
    status?: string
    websiteCards?: Array<{ creation?: CreationReference }>
}

type ReferencingPackage = {
    key?: string
    creations: Array<CreationValue | null>
}

function publishedId(documentId: string) {
    return documentId.replace(/^drafts\./, '')
}

function validatePackageCreations(creations: Array<CreationValue | null>, packageKey: string) {
    const valuesByCreationKey = new Map<string, string>()

    for (const creation of creations) {
        if (!creation?._id || !creation.key?.trim()) {
            return `Package "${packageKey}" has a Website card with a missing creation.`
        }
        if (creation.status !== 'active') {
            return `Package "${packageKey}" references archived creation "${creation.key}".`
        }
        if (!creation.name?.trim()) {
            return `Package "${packageKey}" creation "${creation.key}" has no customer-facing name.`
        }
        const channels = creation.bookingChannels ?? []
        if (
            channels.length === 0 ||
            new Set(channels).size !== channels.length ||
            channels.some(
                (channel) =>
                    !BIRTHDAY_PARTY_BOOKING_CHANNELS.includes(
                        channel as (typeof BIRTHDAY_PARTY_BOOKING_CHANNELS)[number]
                    )
            )
        ) {
            return `Package "${packageKey}" creation "${creation.key}" has invalid availability.`
        }

        for (const value of [creation.key, creation.name, ...(creation.legacyLabels ?? [])]) {
            const normalizedValue = value.trim().toLocaleLowerCase('en-AU')
            if (!normalizedValue) return `Package "${packageKey}" creation "${creation.key}" has an empty label.`

            const existingKey = valuesByCreationKey.get(normalizedValue)
            if (existingKey && existingKey !== creation.key) {
                return `Package "${packageKey}" value "${value}" is ambiguous between creations "${existingKey}" and "${creation.key}".`
            }
            valuesByCreationKey.set(normalizedValue, creation.key)
        }
    }

    return true
}

export async function hasValidPackageCreationReferences(value: SanityDocument | undefined, context: ValidationContext) {
    const partyPackage = value as (SanityDocument & PackageValue) | undefined
    if (partyPackage?.status !== 'active') return true

    const creationIds = Array.from(
        new Set(
            (partyPackage.websiteCards ?? []).flatMap((card) =>
                card.creation?._ref ? [publishedId(card.creation._ref)] : []
            )
        )
    )
    if (creationIds.length === 0) return true

    const creations = await context
        .getClient({ apiVersion: API_VERSION })
        .withConfig({ perspective: 'published', useCdn: false })
        .fetch<Array<CreationValue | null>>(
            `*[_type == "birthdayPartyCreationOffering" && _id in $creationIds]{
                _id,
                bookingChannels,
                key,
                "legacyLabels": coalesce(legacyLabels, []),
                name,
                status
            }`,
            { creationIds }
        )

    return creations.length === creationIds.length
        ? validatePackageCreations(creations, partyPackage.key ?? partyPackage._id)
        : `Package "${partyPackage.key ?? partyPackage._id}" has a Website card with an unpublished creation.`
}

export async function hasValidCreationPackageRelationships(
    value: SanityDocument | undefined,
    context: ValidationContext
) {
    const creation = value as (SanityDocument & CreationValue) | undefined
    if (!creation?._id) return true

    const creationId = publishedId(creation._id)
    const packages = await context
        .getClient({ apiVersion: API_VERSION })
        .withConfig({ perspective: 'published', useCdn: false })
        .fetch<ReferencingPackage[]>(
            `*[
                _type == "birthdayPartyPackage" &&
                !(_id in path("drafts.**")) &&
                status == "active" &&
                $creationId in websiteCards[].creation._ref
            ]{
                key,
                "creations": websiteCards[].creation->{
                    _id,
                    bookingChannels,
                    key,
                    "legacyLabels": coalesce(legacyLabels, []),
                    name,
                    status
                }
            }`,
            { creationId }
        )

    if (creation.status === 'retired' && packages.length > 0) {
        return `Remove this creation from active package "${packages[0].key}" before archiving it.`
    }
    if (creation.status !== 'active') return true

    for (const partyPackage of packages) {
        const packageCreations = partyPackage.creations.map((candidate) =>
            candidate && publishedId(candidate._id ?? '') === creationId ? creation : candidate
        )
        const validation = validatePackageCreations(packageCreations, partyPackage.key ?? 'unknown')
        if (validation !== true) return validation
    }

    return true
}
