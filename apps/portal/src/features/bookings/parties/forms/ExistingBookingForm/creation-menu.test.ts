import { deepStrictEqual, strictEqual } from 'node:assert'

import { describe, it } from 'vite-plus/test'

import type { BirthdayPartyBookingCatalogue } from '@fizz-kidz/core'

import { getBirthdayPartyCreationMenu } from './creation-menu'

const catalogue: BirthdayPartyBookingCatalogue = {
    creations: [
        {
            bookingChannels: ['studio', 'mobile'],
            key: 'fairySlime',
            legacyLabels: [],
            name: 'Fairy Slime',
            status: 'active',
        },
        { bookingChannels: [], key: 'unicornSoap', legacyLabels: [], name: 'Unicorn Soap', status: 'retired' },
    ],
    packages: [
        {
            creations: [
                {
                    bookingOrder: 2,
                    key: 'fairySlime',
                },
                {
                    bookingOrder: 1,
                    key: 'unicornSoap',
                },
            ],
            key: 'fairy',
            name: 'Fairy',
            position: 1,
            status: 'active',
        },
    ],
}

describe('getBirthdayPartyCreationMenu', () => {
    it('shows active creations for the selected channel in booking order', () => {
        const menu = getBirthdayPartyCreationMenu(catalogue, 'mobile')

        deepStrictEqual(
            menu.packages.map((partyPackage) => partyPackage.name),
            ['Fairy']
        )
        deepStrictEqual(
            menu.packages[0].creations.map((creation) => creation.key),
            ['fairySlime']
        )
        strictEqual(menu.previouslySelected, undefined)
    })

    it('retains a selected retired creation without adding it to current choices', () => {
        const menu = getBirthdayPartyCreationMenu(catalogue, 'studio', 'unicornSoap')

        deepStrictEqual(
            menu.packages[0].creations.map((creation) => creation.key),
            ['fairySlime']
        )
        deepStrictEqual(menu.previouslySelected, { key: 'unicornSoap', name: 'Unicorn Soap' })
    })

    it('retains an unknown historical key with a safe label', () => {
        const menu = getBirthdayPartyCreationMenu(catalogue, 'studio', 'historicalKey')

        deepStrictEqual(menu.previouslySelected, { key: 'historicalKey', name: 'historicalKey' })
    })

    it('retains the historical selection when the catalogue cannot be loaded', () => {
        const menu = getBirthdayPartyCreationMenu(undefined, 'studio', 'unicornSoap')

        deepStrictEqual(menu.packages, [])
        deepStrictEqual(menu.previouslySelected, { key: 'unicornSoap', name: 'unicornSoap' })
    })
})
