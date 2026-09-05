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
    offeringDraftsWithImages: number
    packagesWithDuplicateCreationLists: number
    packagesWithLegacyCardFields: number
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
        "offeringDraftsWithImages": count(*[
            _type == "birthdayPartyCreationOffering" &&
            _id in path("drafts.**") &&
            migrationSource == $migrationSource &&
            defined(image.asset._ref)
        ]),
        "packagesWithDuplicateCreationLists": count(*[
            _type == "birthdayPartyPackage" &&
            _id in path("drafts.**") &&
            migrationSource == $migrationSource &&
            defined(offeringEntries)
        ]),
        "packagesWithLegacyCardFields": count(*[
            _type == "birthdayPartyPackage" &&
            _id in path("drafts.**") &&
            migrationSource == $migrationSource &&
            count(websiteCards[defined(offering) || defined(useForBookingChoice)]) > 0
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
strictEqual(counts.offeringDraftsWithImages, counts.offeringDrafts)
strictEqual(counts.packagesWithDuplicateCreationLists, 0)
strictEqual(counts.packagesWithLegacyCardFields, 0)
strictEqual(counts.publishedOfferings, 0, 'Creation documents must remain unpublished at the review gate')

const catalogue = await client.withConfig({ perspective: 'drafts' }).fetch<BirthdayPartyCatalogue>(`
    {
        "packages": *[
            _type == "birthdayPartyPackage" &&
            status == "active" &&
            migrationSource == "${MIGRATION_SOURCE}"
        ] | order(coalesce(position, websitePage.navigation.order, catalogueOrder, websitePage.themeCard.order) asc) {
            _id,
            accentColour,
            blackBackground,
            caption,
            "cards": websiteCards[] {
                _key,
                "alt": coalesce(alt, creation->name + " creation"),
                "bookingChannels": coalesce(bookingChannels, []),
                bookingOrder,
                colour,
                creation->{
                    _id,
                    "image": {
                        "assetId": image.asset->_id,
                        "height": image.asset->metadata.dimensions.height,
                        "src": image.asset->url,
                        "width": image.asset->metadata.dimensions.width
                    },
                    key,
                    "legacyLabels": coalesce(legacyLabels, []),
                    name,
                    recipe->{_id, name},
                    status
                },
                "image": {
                    "assetId": coalesce(image.asset->_id, creation->image.asset->_id),
                    "height": coalesce(
                        image.asset->metadata.dimensions.height,
                        creation->image.asset->metadata.dimensions.height
                    ),
                    "src": coalesce(image.asset->url, creation->image.asset->url),
                    "width": coalesce(
                        image.asset->metadata.dimensions.width,
                        creation->image.asset->metadata.dimensions.width
                    )
                },
                "label": select(hideLabel == true => [], defined(label) => label, [creation->name])
            },
            hidePartyImage,
            key,
            "name": coalesce(packageName, customerName, name),
            "position": coalesce(position, websitePage.navigation.order, catalogueOrder, websitePage.themeCard.order),
            "primaryColour": coalesce(primaryColour, websitePage.hero.theme, colour),
            status,
            websitePage {
                "slug": slug.current,
                seo,
                hero {
                    description,
                    "image": {
                        "assetId": image.asset->_id,
                        "height": image.asset->metadata.dimensions.height,
                        "src": image.asset->url,
                        "width": image.asset->metadata.dimensions.width
                    },
                    imageAlt,
                    subtitle,
                    title
                },
                "creationsImage": select(
                    defined(creationsImage.asset) => {
                        "assetId": creationsImage.asset->_id,
                        "height": creationsImage.asset->metadata.dimensions.height,
                        "src": creationsImage.asset->url,
                        "width": creationsImage.asset->metadata.dimensions.width
                    }
                ),
                navigation { isNew },
                themeCard {
                    "image": {
                        "assetId": image.asset->_id,
                        "height": image.asset->metadata.dimensions.height,
                        "src": image.asset->url,
                        "width": image.asset->metadata.dimensions.width
                    },
                    imageAlt
                },
                "features": coalesce(features[] {
                    _key,
                    title,
                    "headingImage": select(
                        defined(headingImage.asset) => {
                            "assetId": headingImage.asset->_id,
                            "height": headingImage.asset->metadata.dimensions.height,
                            "src": headingImage.asset->url,
                            "width": headingImage.asset->metadata.dimensions.width
                        }
                    ),
                    headingImageAlt,
                    description,
                    cards[] {
                        _key,
                        "alt": imageAlt,
                        colour,
                        "image": {
                            "assetId": image.asset->_id,
                            "height": image.asset->metadata.dimensions.height,
                            "src": image.asset->url,
                            "width": image.asset->metadata.dimensions.width
                        },
                        label
                    }
                }, [])
            }
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
strictEqual(
    catalogue.packages.reduce(
        (count, partyPackage) => count + partyPackage.cards.filter((card) => card.bookingChannels.length > 0).length,
        0
    ),
    77
)
for (const sourcePackage of birthdayPartyCataloguePackages) {
    deepStrictEqual(
        catalogue.packages
            .find((partyPackage) => partyPackage.key === sourcePackage.key)
            ?.cards.filter((card) => card.bookingChannels.length > 0)
            .sort((left, right) => left.bookingOrder! - right.bookingOrder!)
            .map((card) => card.creation.key),
        sourcePackage.offerings.map((offering) => offering.offeringKey)
    )
}
deepStrictEqual(
    catalogue.packages
        .find((partyPackage) => partyPackage.key === 'safari')
        ?.cards.map((card) => `${card.creation.key}:${card.colour}`),
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
    `Verified ${catalogue.packages.length} package drafts with one 83-card sequence, 77 derived booking choices, and ${counts.offeringDrafts} creation drafts with images. Nothing is published.`
)
