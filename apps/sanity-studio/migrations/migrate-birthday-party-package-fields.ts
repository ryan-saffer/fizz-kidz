import { strictEqual } from 'node:assert'

import { getCliClient } from 'sanity/cli'

import {
    BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS,
    isBirthdayPartyPackageColour,
    isBirthdayPartyPackageColourHex,
    type BirthdayPartyPackageColour,
    type BirthdayPartyPackageColourHex,
} from '@fizz-kidz/core'

const API_VERSION = '2026-08-01'
const apply = process.argv.includes('--apply')
const cleanup = process.argv.includes('--cleanup')
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ perspective: 'raw', useCdn: false })
const primaryColourOverrides = new Map<string, BirthdayPartyPackageColour>([['fluidBears', 'black']])
const staffOnlyPositionOverrides = new Map<string, number>([['Sweet Kitty', 11]])
const legacyAccentColourAliases = new Map<string, BirthdayPartyPackageColourHex>([
    ['#43D4F3', '#4DC5DA'],
    ['#F7BB35', '#F6BA33'],
])

type PackageDocument = {
    _id: string
    accentColour?: string
    catalogueOrder?: number
    colour?: BirthdayPartyPackageColour
    customerName?: string
    key?: string
    name?: string
    order?: number
    packageName?: string
    position?: number
    primaryColour?: BirthdayPartyPackageColour
    status?: string
    summaryTitle?: string
    websitePage?: {
        creationsImageAlt?: string
        hero?: { theme?: BirthdayPartyPackageColour }
        navigation?: { order?: number; title?: string }
        themeCard?: { colour?: string; imageAlt?: string; order?: number; title?: string }
    }
}

function normalizeAccentColour(value: string | undefined) {
    if (!value) return undefined
    const uppercaseValue = value.toUpperCase()
    const legacyValue = legacyAccentColourAliases.get(uppercaseValue)
    if (legacyValue) return legacyValue
    return BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS.find((option) => option.hex === uppercaseValue)?.hex
}

function getPosition(partyPackage: PackageDocument) {
    const packageName =
        partyPackage.packageName?.trim() ||
        partyPackage.customerName?.trim() ||
        partyPackage.name?.replace(/\s+Parties$/, '').trim()
    return (
        partyPackage.position ??
        partyPackage.websitePage?.navigation?.order ??
        partyPackage.catalogueOrder ??
        partyPackage.websitePage?.themeCard?.order ??
        (packageName ? staffOnlyPositionOverrides.get(packageName) : undefined)
    )
}

const packageDocuments = await client.fetch<PackageDocument[]>(`*[_type == "birthdayPartyPackage"] | order(order asc)`)
const publishedPackages = packageDocuments.filter((partyPackage) => !partyPackage._id.startsWith('drafts.'))
const publishedIds = new Set(publishedPackages.map((partyPackage) => partyPackage._id))
const packages = packageDocuments.filter(
    (partyPackage) =>
        !partyPackage._id.startsWith('drafts.') || publishedIds.has(partyPackage._id.replace(/^drafts\./, ''))
)

strictEqual(publishedPackages.length > 0, true, 'No published package documents found.')

const changes = packages.flatMap((partyPackage) => {
    const packageName =
        partyPackage.packageName?.trim() ||
        partyPackage.customerName?.trim() ||
        partyPackage.name?.replace(/\s+Parties$/, '').trim()
    const primaryColour =
        (partyPackage.key ? primaryColourOverrides.get(partyPackage.key) : undefined) ??
        partyPackage.primaryColour ??
        partyPackage.websitePage?.hero?.theme ??
        partyPackage.colour
    const accentColour = normalizeAccentColour(partyPackage.accentColour)
    const position = getPosition(partyPackage)

    if (!packageName) throw new Error(`Package "${partyPackage._id}" has no usable package name.`)
    if (!primaryColour || !isBirthdayPartyPackageColour(primaryColour)) {
        throw new Error(`Package "${partyPackage.key ?? partyPackage._id}" has no valid primary colour.`)
    }
    if (partyPackage.status === 'active' && !accentColour) {
        throw new Error(`Package "${partyPackage.key}" has no valid accent colour.`)
    }
    if (partyPackage.status === 'active' && (!Number.isInteger(position) || (position ?? 0) < 1)) {
        throw new Error(`Package "${partyPackage.key}" has no valid Website position.`)
    }

    const hasDuplicateFields =
        partyPackage.colour !== undefined ||
        partyPackage.catalogueOrder !== undefined ||
        partyPackage.customerName !== undefined ||
        partyPackage.name !== undefined ||
        partyPackage.order !== undefined ||
        partyPackage.summaryTitle !== undefined ||
        partyPackage.websitePage?.creationsImageAlt !== undefined ||
        partyPackage.websitePage?.hero?.theme !== undefined ||
        partyPackage.websitePage?.navigation?.title !== undefined ||
        partyPackage.websitePage?.navigation?.order !== undefined ||
        partyPackage.websitePage?.themeCard?.colour !== undefined ||
        partyPackage.websitePage?.themeCard?.order !== undefined ||
        partyPackage.websitePage?.themeCard?.title !== undefined
    const needsCanonicalFields =
        partyPackage.packageName !== packageName ||
        partyPackage.primaryColour !== primaryColour ||
        partyPackage.accentColour !== accentColour ||
        partyPackage.position !== position
    if (!needsCanonicalFields && (!cleanup || !hasDuplicateFields)) return []

    return [{ _id: partyPackage._id, accentColour, packageName, position, primaryColour }]
})

strictEqual(new Set(changes.map((change) => change._id)).size, changes.length)
for (const [description, documents] of [
    ['published packages', publishedPackages],
    [
        'draft perspective',
        Array.from(
            new Map(
                packages
                    .toSorted(
                        (left, right) =>
                            Number(left._id.startsWith('drafts.')) - Number(right._id.startsWith('drafts.'))
                    )
                    .map((partyPackage) => [partyPackage._id.replace(/^drafts\./, ''), partyPackage] as const)
            ).values()
        ),
    ],
] as const) {
    const activePositions = documents
        .filter((partyPackage) => partyPackage.status === 'active')
        .map((partyPackage) => getPosition(partyPackage))
    strictEqual(
        new Set(activePositions).size,
        activePositions.length,
        `Active package Website positions must be unique in ${description}.`
    )
}
console.log(
    `${changes.length} package documents need ${cleanup ? 'legacy-field cleanup' : 'canonical-field backfill'}.`
)

if (!apply) {
    console.log(changes.length ? 'No documents changed. Run again with --apply.' : 'No documents changed.')
    process.exit(0)
}
if (changes.length === 0) process.exit(0)

let transaction = client.transaction()
for (const change of changes) {
    transaction = transaction.patch(change._id, (patch) =>
        patch
            .set({
                ...(change.accentColour ? { accentColour: change.accentColour } : {}),
                packageName: change.packageName,
                ...(change.position !== undefined ? { position: change.position } : {}),
                primaryColour: change.primaryColour,
            })
            .unset(
                cleanup
                    ? [
                          'colour',
                          'catalogueOrder',
                          'customerName',
                          'name',
                          'order',
                          'summaryTitle',
                          'websitePage.creationsImageAlt',
                          'websitePage.hero.theme',
                          'websitePage.navigation.title',
                          'websitePage.navigation.order',
                          'websitePage.themeCard.colour',
                          'websitePage.themeCard.order',
                          'websitePage.themeCard.title',
                      ]
                    : []
            )
    )
}

const result = await transaction.commit({ visibility: 'sync' })
strictEqual(result.results.length, changes.length)

const migratedPackageDocuments = await client.fetch<PackageDocument[]>(`*[_type == "birthdayPartyPackage"]`)
const migratedPackages = migratedPackageDocuments.filter(
    (partyPackage) =>
        !partyPackage._id.startsWith('drafts.') || publishedIds.has(partyPackage._id.replace(/^drafts\./, ''))
)
strictEqual(migratedPackages.length, packages.length)
for (const partyPackage of migratedPackages) {
    if (!partyPackage.primaryColour || !isBirthdayPartyPackageColour(partyPackage.primaryColour)) {
        throw new Error(`Package "${partyPackage.key ?? partyPackage._id}" was not assigned a valid primary colour.`)
    }
    if (partyPackage.status === 'active' && !isBirthdayPartyPackageColourHex(partyPackage.accentColour)) {
        throw new Error(`Package "${partyPackage.key ?? partyPackage._id}" was not assigned a valid accent colour.`)
    }
    if (!partyPackage.packageName) {
        throw new Error(`Package "${partyPackage.key ?? partyPackage._id}" was not assigned a package name.`)
    }
    if (partyPackage.status === 'active' && (!Number.isInteger(partyPackage.position) || partyPackage.position! < 1)) {
        throw new Error(`Package "${partyPackage.key ?? partyPackage._id}" was not assigned a Website position.`)
    }
    if (cleanup) {
        strictEqual(
            partyPackage.colour !== undefined ||
                partyPackage.catalogueOrder !== undefined ||
                partyPackage.customerName !== undefined ||
                partyPackage.name !== undefined ||
                partyPackage.order !== undefined ||
                partyPackage.summaryTitle !== undefined ||
                partyPackage.websitePage?.creationsImageAlt !== undefined ||
                partyPackage.websitePage?.hero?.theme !== undefined ||
                partyPackage.websitePage?.navigation?.title !== undefined ||
                partyPackage.websitePage?.navigation?.order !== undefined ||
                partyPackage.websitePage?.themeCard?.colour !== undefined ||
                partyPackage.websitePage?.themeCard?.order !== undefined ||
                partyPackage.websitePage?.themeCard?.title !== undefined,
            false
        )
    }
}
console.log(
    `${cleanup ? 'Removed legacy fields from' : 'Backfilled canonical fields on'} ${result.results.length} package documents.`
)
