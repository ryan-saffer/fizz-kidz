import { deepStrictEqual, strictEqual } from 'node:assert'

import { getCliClient } from 'sanity/cli'

const API_VERSION = '2026-08-01'
const apply = process.argv.includes('--apply')
const cleanup = process.argv.includes('--cleanup')
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ perspective: 'raw', useCdn: false })

type Reference = {
    _ref: string
    _type: 'reference'
}

type CreationDocument = {
    _id: string
    creationInstructions?: Reference
    key?: string
    recipe?: Reference
}

const creations = await client.fetch<CreationDocument[]>(
    `*[_type == "birthdayPartyCreationOffering"]{_id,key,creationInstructions,recipe}`
)

const changes = creations.flatMap((creation) => {
    if (creation.creationInstructions && creation.recipe) {
        deepStrictEqual(
            creation.creationInstructions._ref,
            creation.recipe._ref,
            `Creation "${creation.key ?? creation._id}" has conflicting instruction references.`
        )
    }

    const needsBackfill = !creation.creationInstructions && creation.recipe
    const needsCleanup = cleanup && creation.recipe
    if (!needsBackfill && !needsCleanup) return []

    return [
        {
            _id: creation._id,
            creationInstructions: creation.creationInstructions ?? creation.recipe,
            removeRecipe: Boolean(needsCleanup),
        },
    ]
})

console.log(`${changes.length} creation documents need ${cleanup ? 'instruction-reference cleanup' : 'backfill'}.`)
if (!apply) {
    console.log(changes.length ? 'No documents changed. Run again with --apply.' : 'No documents changed.')
    process.exit(0)
}
if (changes.length === 0) process.exit(0)

let transaction = client.transaction()
for (const change of changes) {
    transaction = transaction.patch(change._id, (patch) => {
        let nextPatch = change.creationInstructions
            ? patch.set({ creationInstructions: change.creationInstructions })
            : patch
        if (change.removeRecipe) nextPatch = nextPatch.unset(['recipe'])
        return nextPatch
    })
}

const result = await transaction.commit({ visibility: 'sync' })
strictEqual(result.results.length, changes.length)

const invalidCount = await client.fetch<number>(
    cleanup
        ? `count(*[_type == "birthdayPartyCreationOffering" && defined(recipe)])`
        : `count(*[
              _type == "birthdayPartyCreationOffering" &&
              defined(recipe) &&
              creationInstructions._ref != recipe._ref
          ])`
)
strictEqual(invalidCount, 0, cleanup ? 'Legacy instruction references remain.' : 'Instruction backfill is incomplete.')

console.log(`${cleanup ? 'Cleaned' : 'Backfilled'} ${result.results.length} creation documents.`)
