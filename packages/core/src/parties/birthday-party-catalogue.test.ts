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
            cards: [
                {
                    _key: 'card-1',
                    alt: 'Green monster slime in a jar',
                    colour: 'green',
                    image: {
                        assetId: 'image-1',
                        height: 500,
                        src: 'https://cdn.sanity.io/image-1.png',
                        width: 500,
                    },
                    label: ['Monster Slime'],
                    offeringKey: 'monsterSlime',
                    useForBookingChoice: true,
                },
            ],
            offerings: [
                {
                    _key: 'entry-1',
                    availability: ['studio', 'mobile'],
                    offering: {
                        _id: 'offering-1',
                        key: 'monsterSlime',
                        name: 'Monster Slime',
                        status: 'active',
                        legacyLabels: [],
                    },
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

    it('rejects an offering that is unavailable through every booking channel', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].offerings[0].availability = []

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" offering "monsterSlime" must have at least one booking channel/
        )
    })

    it('rejects a creation card without a complete image', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].cards[0].image = undefined as never

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" offering "monsterSlime" card "card-1" must have an image/
        )
    })

    it('rejects duplicate stable package keys', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages.push({ ...structuredClone(catalogue.packages[0]), _id: 'package-2' })

        throws(() => validateBirthdayPartyCatalogue(catalogue), /Duplicate package key "slime"/)
    })

    it('rejects duplicate offerings within a package', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].offerings.push({
            ...structuredClone(catalogue.packages[0].offerings[0]),
            _key: 'entry-2',
        })

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" contains duplicate offering "monsterSlime"/
        )
    })

    it('rejects ambiguous current and legacy labels within a package', () => {
        const catalogue = structuredClone(validCatalogue)
        const secondOffering = structuredClone(catalogue.packages[0].offerings[0])
        secondOffering._key = 'entry-2'
        secondOffering.offering = {
            _id: 'offering-2',
            key: 'alienSlime',
            legacyLabels: [' monster slime '],
            name: 'Alien Slime',
            status: 'active',
        }
        catalogue.packages[0].offerings.push(secondOffering)

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" label "monster slime" is ambiguous between offerings "monsterSlime" and "alienSlime"/
        )
    })

    it('supports non-contiguous presentation cards with exactly one booking choice image', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].offerings.push({
            _key: 'entry-2',
            availability: ['studio'],
            offering: {
                _id: 'offering-2',
                key: 'alienSlime',
                legacyLabels: [],
                name: 'Alien Slime',
                status: 'active',
            },
        })
        catalogue.packages[0].cards.push(
            {
                ...structuredClone(catalogue.packages[0].cards[0]),
                _key: 'card-2',
                label: ['Alien Slime'],
                offeringKey: 'alienSlime',
            },
            {
                ...structuredClone(catalogue.packages[0].cards[0]),
                _key: 'card-3',
                useForBookingChoice: false,
            }
        )

        deepStrictEqual(validateBirthdayPartyCatalogue(catalogue), catalogue)

        catalogue.packages[0].cards[2].useForBookingChoice = true
        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" offering "monsterSlime" must have exactly one booking choice image/
        )
    })

    it('rejects a broken offering reference with its package and entry keys', () => {
        const catalogue = structuredClone(validCatalogue)
        catalogue.packages[0].offerings[0].offering = null as never

        throws(
            () => validateBirthdayPartyCatalogue(catalogue),
            /Package "slime" entry "entry-1" has a missing offering reference/
        )
    })

    it('rejects incomplete active package and offering content', () => {
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
                expected: /Package "slime" must contain at least one offering/,
                mutate: (catalogue) => (catalogue.packages[0].offerings = []),
            },
            {
                expected: /Package "slime" offering "offering-1" must have a stable key/,
                mutate: (catalogue) => (catalogue.packages[0].offerings[0].offering.key = ''),
            },
            {
                expected: /Package "slime" offering "monsterSlime" must be active/,
                mutate: (catalogue) => (catalogue.packages[0].offerings[0].offering.status = 'retired'),
            },
            {
                expected: /Package "slime" offering "monsterSlime" card "card-1" must have useful alt text/,
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
