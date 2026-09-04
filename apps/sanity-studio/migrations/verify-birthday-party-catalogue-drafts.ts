import { deepStrictEqual, strictEqual } from 'node:assert'

import { getCliClient } from 'sanity/cli'

import {
    validateBirthdayPartyCatalogue,
    type BirthdayPartyCatalogue,
} from '../../../packages/core/src/parties/birthday-party-catalogue'
import { birthdayPartyCatalogueOfferings, birthdayPartyCataloguePackages } from './birthday-party-catalogue-source'

const API_VERSION = '2026-08-01'
const MIGRATION_SOURCE = 'website-catalogue-phase-1-2026-09'
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ perspective: 'raw', useCdn: false })

const counts = await client.fetch<{
    migratedPackageDrafts: number
    offeringDrafts: number
    publishedOfferings: number
}>(
    `{
        "migratedPackageDrafts": count(*[
            _type == "birthdayPartyPackage" &&
            _id in path("drafts.**") &&
            migrationSource == $migrationSource
        ]),
        "offeringDrafts": count(*[
            _type == "birthdayPartyCreationOffering" &&
            _id in path("drafts.**") &&
            migrationSource == $migrationSource
        ]),
        "publishedOfferings": count(*[
            _type == "birthdayPartyCreationOffering" &&
            !(_id in path("drafts.**"))
        ])
    }`,
    { migrationSource: MIGRATION_SOURCE }
)

strictEqual(counts.migratedPackageDrafts, birthdayPartyCataloguePackages.length)
strictEqual(counts.offeringDrafts, Object.keys(birthdayPartyCatalogueOfferings).length)
strictEqual(counts.publishedOfferings, 0, 'Customer offering documents must remain unpublished at the review gate')

const catalogue = await client.withConfig({ perspective: 'drafts' }).fetch<BirthdayPartyCatalogue>(`
    {
        "packages": *[
            _type == "birthdayPartyPackage" &&
            status == "active" &&
            migrationSource == "${MIGRATION_SOURCE}"
        ] | order(catalogueOrder asc) {
            _id,
            accentColour,
            blackBackground,
            caption,
            "cards": websiteCards[] {
                _key,
                alt,
                colour,
                "image": {
                    "assetId": image.asset->_id,
                    "height": image.asset->metadata.dimensions.height,
                    "src": image.asset->url,
                    "width": image.asset->metadata.dimensions.width
                },
                "label": coalesce(label, []),
                "offeringKey": offering->key,
                useForBookingChoice
            },
            hidePartyImage,
            key,
            "name": customerName,
            "offerings": offeringEntries[] {
                _key,
                availability,
                offering->{
                    _id,
                    key,
                    "legacyLabels": coalesce(legacyLabels, []),
                    name,
                    recipe->{_id, name},
                    status
                }
            },
            "order": catalogueOrder,
            status,
            summaryTitle
        }
    }
`)

validateBirthdayPartyCatalogue(catalogue)
deepStrictEqual(
    catalogue.packages.map((partyPackage) => partyPackage.key),
    birthdayPartyCataloguePackages.map((partyPackage) => partyPackage.key)
)
strictEqual(
    catalogue.packages.reduce((count, partyPackage) => count + partyPackage.cards.length, 0),
    83
)
deepStrictEqual(
    catalogue.packages
        .find((partyPackage) => partyPackage.key === 'safari')
        ?.cards.map((card) => `${card.offeringKey}:${card.colour}`),
    [
        'monsterSlime:purple',
        'monsterExplosions:green',
        'bugsInBathBombs:green',
        'monsterSlime:green',
        'dinosaurBathBombs:green',
        'volcanoes:red',
        'firePotions:red',
        'snakePotions:green',
    ]
)

console.log(
    `Verified ${catalogue.packages.length} package drafts, ${counts.offeringDrafts} offering drafts, and 83 ordered Website cards. Nothing is published.`
)
