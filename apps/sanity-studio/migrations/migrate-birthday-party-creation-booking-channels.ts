import { deepStrictEqual, strictEqual } from 'node:assert'
import { isDeepStrictEqual } from 'node:util'

import { getCliClient } from 'sanity/cli'

import {
    birthdayPartyCatalogueOfferings,
    getBirthdayPartyCatalogueBookingChannels,
} from './birthday-party-catalogue-source'

const API_VERSION = '2026-08-01'
const apply = process.argv.includes('--apply')
const cleanupCards = process.argv.includes('--cleanup-cards')
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ perspective: 'raw', useCdn: false })

type CreationDocument = {
    _id: string
    bookingChannels?: string[]
    key?: string
    status?: string
}

type PackageCard = Record<string, unknown> & {
    bookingChannels?: string[]
}

type PackageDocument = {
    _id: string
    websiteCards?: PackageCard[]
}

const [creationDocuments, packageDocuments] = await Promise.all([
    client.fetch<CreationDocument[]>(`*[_type == "birthdayPartyCreationOffering"]{_id,key,status,bookingChannels}`),
    client.fetch<PackageDocument[]>(`*[_type == "birthdayPartyPackage"]{_id,websiteCards}`),
])

function hasValidBookingChannels(channels: string[] | undefined) {
    return (
        Array.isArray(channels) &&
        channels.length > 0 &&
        new Set(channels).size === channels.length &&
        channels.every((channel) => channel === 'studio' || channel === 'mobile')
    )
}

const activeSourceKeys = Object.keys(birthdayPartyCatalogueOfferings) as Array<
    keyof typeof birthdayPartyCatalogueOfferings
>

if (cleanupCards) {
    for (const document of creationDocuments.filter((candidate) => candidate.status === 'active')) {
        if (!document.key || !hasValidBookingChannels(document.bookingChannels)) {
            throw new Error(`Live creation "${document.key ?? document._id}" has invalid availability.`)
        }
    }
} else {
    for (const key of activeSourceKeys) {
        const published = creationDocuments.find(
            (document) => !document._id.startsWith('drafts.') && document.status === 'active' && document.key === key
        )
        if (!published) throw new Error(`Published live creation "${key}" is missing.`)
    }
}

const creationChanges = cleanupCards
    ? []
    : creationDocuments.flatMap((document) => {
          if (document.status !== 'active' || !document.key || !(document.key in birthdayPartyCatalogueOfferings)) {
              return []
          }

          const expectedChannels = getBirthdayPartyCatalogueBookingChannels(
              document.key as keyof typeof birthdayPartyCatalogueOfferings
          )
          if (document.bookingChannels === undefined || document.bookingChannels.length === 0) {
              return [{ _id: document._id, bookingChannels: expectedChannels }]
          }
          if (!isDeepStrictEqual(document.bookingChannels, expectedChannels)) {
              throw new Error(
                  `Live creation "${document.key}" already has availability that differs from the migration source.`
              )
          }
          return []
      })

const packageChanges = cleanupCards
    ? packageDocuments.flatMap((partyPackage) => {
          const cards = partyPackage.websiteCards ?? []
          if (!cards.some((card) => card.bookingChannels !== undefined)) return []
          return [
              {
                  _id: partyPackage._id,
                  websiteCards: cards.map((card) => {
                      const migratedCard = { ...card }
                      delete migratedCard.bookingChannels
                      return migratedCard
                  }),
              },
          ]
      })
    : []

console.log(`${creationChanges.length} live creation documents need availability backfill.`)
if (cleanupCards) console.log(`${packageChanges.length} package documents need legacy card availability cleanup.`)

if (!apply) {
    console.log(
        creationChanges.length || packageChanges.length
            ? 'No documents changed. Run again with --apply.'
            : 'No documents changed.'
    )
    process.exit(0)
}
if (creationChanges.length === 0 && packageChanges.length === 0) process.exit(0)

let transaction = client.transaction()
for (const change of creationChanges) {
    transaction = transaction.patch(change._id, (patch) => patch.set({ bookingChannels: change.bookingChannels }))
}
for (const change of packageChanges) {
    transaction = transaction.patch(change._id, (patch) => patch.set({ websiteCards: change.websiteCards }))
}

const result = await transaction.commit({ visibility: 'sync' })
strictEqual(result.results.length, creationChanges.length + packageChanges.length)

if (cleanupCards) {
    const remainingLegacyCardFields = await client.fetch<number>(
        `count(*[_type == "birthdayPartyPackage" && count(websiteCards[defined(bookingChannels)]) > 0])`
    )
    strictEqual(remainingLegacyCardFields, 0, 'Legacy card availability remains after cleanup.')
} else {
    const migratedCreations = await client.fetch<CreationDocument[]>(
        `*[_type == "birthdayPartyCreationOffering" && status == "active" && !(_id in path("drafts.**")) && key in $keys]{key,bookingChannels}`,
        { keys: activeSourceKeys }
    )
    strictEqual(migratedCreations.length, activeSourceKeys.length)
    for (const document of migratedCreations) {
        if (!document.key || !(document.key in birthdayPartyCatalogueOfferings)) {
            throw new Error(`Expected live creation key "${document.key}" was not found.`)
        }
        deepStrictEqual(
            document.bookingChannels,
            getBirthdayPartyCatalogueBookingChannels(document.key as keyof typeof birthdayPartyCatalogueOfferings)
        )
    }
}

console.log(
    `Backfilled ${creationChanges.length} live creations${cleanupCards ? ` and cleaned ${packageChanges.length} packages` : ''}.`
)
