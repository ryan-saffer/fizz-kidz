import { deepStrictEqual, throws } from 'assert'

import { describe, it } from 'vite-plus/test'

import { validateBirthdayPartyCatalogue, type BirthdayPartyCatalogue } from './birthday-party-catalogue'

const validCatalogue: BirthdayPartyCatalogue = {
    packages: [
        {
            _id: 'package-1',
            key: 'slime',
            name: 'Slime',
            status: 'active',
            order: 1,
            summaryTitle: 'Slime Creations',
            accentColour: '#9044E2',
            websitePage: {
                slug: 'slime-parties',
                seo: {
                    title: 'Kids Slime Birthday Parties | Fizz Kidz',
                    description: 'A hosted slime birthday party.',
                    serviceName: 'Kids Slime Birthday Party',
                },
                hero: {
                    title: 'Kids Slime Birthday Parties',
                    subtitle: 'Slime, slime and more slime!',
                    description: 'Together lets get messy and make the most perfect slimes!',
                    theme: 'purple',
                    image: {
                        assetId: 'hero-image',
                        height: 800,
                        src: 'https://cdn.sanity.io/hero-image.png',
                        width: 1200,
                    },
                    imageAlt: 'A child holding slime',
                },
                creationsImage: {
                    assetId: 'package-image',
                    height: 500,
                    src: 'https://cdn.sanity.io/package-image.png',
                    width: 500,
                },
                creationsImageAlt: 'Slime Party Package',
                navigation: {
                    title: 'Slime Parties',
                    order: 1,
                    isNew: false,
                },
                themeCard: {
                    title: 'Slime Parties',
                    order: 1,
                    colour: '#9044E2',
                    image: {
                        assetId: 'theme-image',
                        height: 500,
                        src: 'https://cdn.sanity.io/theme-image.png',
                        width: 500,
                    },
                    imageAlt: 'A child holding slime',
                },
                features: [],
            },
            cards: [
                {
                    _key: 'card-1',
                    alt: 'Green monster slime in a jar',
                    bookingChannels: ['studio', 'mobile'],
                    bookingOrder: 1,
                    colour: 'green',
                    creation: {
                        _id: 'creation-1',
                        image: {
                            assetId: 'image-1',
                            height: 500,
                            src: 'https://cdn.sanity.io/image-1.png',
                            width: 500,
                        },
                        key: 'monsterSlime',
                        name: 'Monster Slime',
                        status: 'active',
                        legacyLabels: [],
                    },
                    image: {
                        assetId: 'image-1',
                        height: 500,
                        src: 'https://cdn.sanity.io/image-1.png',
                        width: 500,
                    },
                    label: ['Monster Slime'],
                },
            ],
        },
    ],
}

describe('validateBirthdayPartyCatalogue', () => {
    it('rejects an empty published catalogue', () => {
        throws(
            () => validateBirthdayPartyCatalogue({ packages: [] }),
            /Birthday party catalogue must contain at least one package/
        )
    })

    it('returns a complete active catalogue unchanged', () => {
        deepStrictEqual(validateBirthdayPartyCatalogue(validCatalogue), validCatalogue)
    })

    it('requires exactly one booking card for every creation', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards[0].bookingChannels = []
        catalogue.packages[0].cards[0].bookingOrder = undefined

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" creation "monsterSlime" must have exactly one booking card/
        )
    })

    it('rejects invalid booking channels', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards[0].bookingChannels = ['studio', 'studio']

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" creation "monsterSlime" has invalid booking channels/
        )
    })

    it('rejects a creation card without a complete image', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards[0].image = undefined as never

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" creation "monsterSlime" card "card-1" must have an image/
        )
    })

    it('rejects duplicate stable package keys', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages.push({ ...structuredClone(catalogue.packages[0]), _id: 'package-2' })

        throws(() => validateBirthdayPartyCatalogue(catalogue), /Duplicate package key "slime"/)
    })

    it('rejects missing or conflicting Website routes and listing orders', () => {
        const missingPage = structuredClone(validCatalogue)
        missingPage.packages[0].websitePage = undefined as never
        throws(() => validateBirthdayPartyCatalogue(missingPage), /Package "slime" must have Website page content/)

        const duplicated = structuredClone(validCatalogue)
        duplicated.packages.push({
            ...structuredClone(duplicated.packages[0]),
            _id: 'package-2',
            key: 'science',
            order: 2,
        })
        throws(() => validateBirthdayPartyCatalogue(duplicated), /Duplicate Website slug "slime-parties"/)

        duplicated.packages[1].websitePage.slug = 'science-parties'
        throws(() => validateBirthdayPartyCatalogue(duplicated), /Duplicate navigation order "1"/)

        duplicated.packages[1].websitePage.navigation.order = 2
        throws(() => validateBirthdayPartyCatalogue(duplicated), /Duplicate theme-card order "1"/)
    })

    it('rejects reserved Website routes and incomplete page images', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].websitePage.slug = 'creations'
        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" uses reserved Website slug "creations"/
        )

        catalogue.packages[0].websitePage.slug = 'slime-parties'
        catalogue.packages[0].websitePage.hero.image = undefined as never
        throws(() => validateBirthdayPartyCatalogue(catalogue), /Package "slime" must have a hero image/)

        catalogue.packages[0].websitePage.hero.image = structuredClone(
            validCatalogue.packages[0].websitePage.hero.image
        )
        catalogue.packages[0].websitePage.creationsImage = undefined
        throws(() => validateBirthdayPartyCatalogue(catalogue), /Package "slime" must have a creations-section image/)

        catalogue.packages[0].hidePartyImage = true
        deepStrictEqual(validateBirthdayPartyCatalogue(catalogue), catalogue)
    })

    it('validates optional package feature sections', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].websitePage.features.push({
            _key: 'slime-lab',
            cards: [
                {
                    _key: 'choose-base',
                    alt: 'Slime base options',
                    colour: 'white',
                    image: {
                        assetId: 'feature-card-image',
                        height: 500,
                        src: 'https://cdn.sanity.io/feature-card-image.png',
                        width: 500,
                    },
                    label: ['Choose your base'],
                },
            ],
            description: 'Design your slime from scratch.',
            title: 'Slime Lab',
        })
        deepStrictEqual(validateBirthdayPartyCatalogue(catalogue), catalogue)

        catalogue.packages[0].websitePage.features[0].cards[0].label = []
        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" feature "slime-lab" card "choose-base" must have a label/
        )
    })

    it('rejects one stable creation key belonging to different documents', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards.push({
            ...structuredClone(catalogue.packages[0].cards[0]),
            _key: 'card-2',
            bookingChannels: [],
            bookingOrder: undefined,
            creation: {
                ...structuredClone(catalogue.packages[0].cards[0].creation),
                _id: 'creation-2',
            },
        })

        throws(() => validateBirthdayPartyCatalogue(catalogue), /Duplicate creation key "monsterSlime"/)
    })

    it('rejects ambiguous current and legacy labels within a package', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards.push({
            ...structuredClone(catalogue.packages[0].cards[0]),
            _key: 'card-2',
            bookingChannels: ['studio'],
            bookingOrder: 2,
            creation: {
                _id: 'creation-2',
                image: {
                    assetId: 'image-2',
                    height: 500,
                    src: 'https://cdn.sanity.io/image-2.png',
                    width: 500,
                },
                key: 'alienSlime',
                legacyLabels: [' monster slime '],
                name: 'Alien Slime',
                status: 'active',
            },
            image: {
                assetId: 'image-2',
                height: 500,
                src: 'https://cdn.sanity.io/image-2.png',
                width: 500,
            },
            label: ['Alien Slime'],
        })

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" label "monster slime" is ambiguous between creations "monsterSlime" and "alienSlime"/
        )
    })

    it('supports non-contiguous presentation cards with exactly one booking card', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards.push(
            {
                ...structuredClone(catalogue.packages[0].cards[0]),
                _key: 'card-2',
                bookingChannels: ['studio'],
                bookingOrder: 2,
                creation: {
                    _id: 'creation-2',
                    image: {
                        assetId: 'image-2',
                        height: 500,
                        src: 'https://cdn.sanity.io/image-2.png',
                        width: 500,
                    },
                    key: 'alienSlime',
                    legacyLabels: [],
                    name: 'Alien Slime',
                    status: 'active',
                },
                image: {
                    assetId: 'image-2',
                    height: 500,
                    src: 'https://cdn.sanity.io/image-2.png',
                    width: 500,
                },
                label: ['Alien Slime'],
            },
            {
                ...structuredClone(catalogue.packages[0].cards[0]),
                _key: 'card-3',
                bookingChannels: [],
                bookingOrder: undefined,
            }
        )

        deepStrictEqual(validateBirthdayPartyCatalogue(catalogue), catalogue)

        catalogue.packages[0].cards[2].bookingChannels = ['mobile']
        catalogue.packages[0].cards[2].bookingOrder = 3
        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" creation "monsterSlime" must have exactly one booking card/
        )
    })

    it('requires consecutive unique booking orders', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards[0].bookingOrder = 2

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" booking orders must be consecutive from 1/
        )
    })

    it('rejects a broken creation reference with its package and card keys', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards[0].creation = null as never

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" card "card-1" has a missing creation reference/
        )
    })

    it('rejects incomplete active package and creation content', () => {
        const cases: Array<{
            expected: RegExp
            mutate: (catalogue: BirthdayPartyCatalogue) => void
        }> = [
            {
                expected: /Active package "package-1" must have a stable key/,
                mutate: (catalogue) => (catalogue.packages[0].key = ''),
            },
            {
                expected: /Package "slime" must have a customer-facing name/,
                mutate: (catalogue) => (catalogue.packages[0].name = ''),
            },
            {
                expected: /Package "slime" must contain at least one Website card/,
                mutate: (catalogue) => (catalogue.packages[0].cards = []),
            },
            {
                expected: /Package "slime" creation "creation-1" must have a stable key/,
                mutate: (catalogue) => (catalogue.packages[0].cards[0].creation.key = ''),
            },
            {
                expected: /Package "slime" creation "monsterSlime" must be active/,
                mutate: (catalogue) => (catalogue.packages[0].cards[0].creation.status = 'retired'),
            },
            {
                expected: /Package "slime" creation "monsterSlime" must have an image/,
                mutate: (catalogue) => (catalogue.packages[0].cards[0].creation.image = undefined as never),
            },
            {
                expected: /Package "slime" creation "monsterSlime" card "card-1" must have useful alt text/,
                mutate: (catalogue) => (catalogue.packages[0].cards[0].alt = ' '),
            },
        ]

        for (const testCase of cases) {
            const catalogue = structuredClone(validCatalogue)
            testCase.mutate(catalogue)
            throws(() => validateBirthdayPartyCatalogue(catalogue), testCase.expected)
        }
    })
})
