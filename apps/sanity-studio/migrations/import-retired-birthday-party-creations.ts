import { strictEqual } from 'node:assert'

import { getCliClient } from 'sanity/cli'

import { ACTIVE_CREATIONS, CREATIONS } from '../../../packages/core/src/parties/creations'

const API_VERSION = '2026-08-01'
const MIGRATION_SOURCE = 'legacy-retired-creations-2026-09'
const apply = process.argv.includes('--apply')
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ perspective: 'raw', useCdn: false })

type CreationDocument = {
    _id: string
    key?: string
    name?: string
    status?: string
}

const retiredCreations = Object.entries(CREATIONS)
    .filter(([key]) => !Object.prototype.hasOwnProperty.call(ACTIVE_CREATIONS, key))
    .map(([key, name]) => ({ key, name }))

strictEqual(new Set(retiredCreations.map((creation) => creation.key)).size, retiredCreations.length)

const existingDocuments = await client.fetch<CreationDocument[]>(
    `*[_type == "birthdayPartyCreationOffering"]{_id,key,name,status}`
)
const existingByKey = new Map<string, CreationDocument[]>()
for (const document of existingDocuments) {
    if (!document.key) continue
    existingByKey.set(document.key, [...(existingByKey.get(document.key) ?? []), document])
}

const missingCreations = retiredCreations.filter(({ key, name }) => {
    const existing = existingByKey.get(key) ?? []
    const documentIds = new Set(existing.map((document) => document._id.replace(/^drafts\./, '')))
    if (documentIds.size > 1) throw new Error(`Creation key "${key}" belongs to multiple documents.`)

    const published = existing.find((document) => !document._id.startsWith('drafts.'))
    if (!published && existing.length > 0) {
        throw new Error(`Creation key "${key}" has an unpublished draft. Review it before running this migration.`)
    }
    if (!published) return true
    if (published.name !== name || published.status !== 'retired') {
        throw new Error(`Creation key "${key}" already exists with different content.`)
    }
    return false
})

console.log(`${missingCreations.length} retired creation documents need importing.`)
if (!apply) {
    console.log(missingCreations.length ? 'No documents changed. Run again with --apply.' : 'No documents changed.')
    process.exit(0)
}
if (missingCreations.length === 0) process.exit(0)

let transaction = client.transaction()
for (const creation of missingCreations) {
    transaction = transaction.create({
        _type: 'birthdayPartyCreationOffering',
        key: creation.key,
        legacyLabels: [],
        migrationSource: MIGRATION_SOURCE,
        name: creation.name,
        status: 'retired',
    })
}

const result = await transaction.commit({ visibility: 'sync' })
strictEqual(result.results.length, missingCreations.length)

const imported = await client.fetch<CreationDocument[]>(
    `*[
        _type == "birthdayPartyCreationOffering" &&
        !(_id in path("drafts.**")) &&
        key in $keys
    ]{_id,key,name,status}`,
    { keys: retiredCreations.map((creation) => creation.key) }
)
strictEqual(imported.length, retiredCreations.length)
for (const source of retiredCreations) {
    const document = imported.find((candidate) => candidate.key === source.key)
    if (!document || document.name !== source.name || document.status !== 'retired') {
        throw new Error(`Retired creation "${source.key}" was not imported correctly.`)
    }
}

console.log(`Imported ${result.results.length} retired creation documents.`)
