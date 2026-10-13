import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { getStudioAddress } from '@fizz-kidz/core'
import type { BirthdayPartyBookingCatalogue } from '@fizz-kidz/core'

import { getPartyFormConfig } from '../get-party-form-config'

import { DocumentNotFoundError } from '@/integrations/firebase/document-not-found-error'

const {
    getPartyBooking,
    getCatalogue,
    getImages,
    getAdditions,
    getCakeOptions,
    getStockedCakeOptions,
    getTakeHomeOptions,
} = vi.hoisted(() => ({
    getPartyBooking: vi.fn(),
    getCatalogue: vi.fn(),
    getImages: vi.fn(),
    getAdditions: vi.fn(),
    getCakeOptions: vi.fn(),
    getStockedCakeOptions: vi.fn(),
    getTakeHomeOptions: vi.fn(),
}))
vi.mock('../../options/get-party-form-additions', () => ({ getPartyFormAdditions: getAdditions }))
vi.mock('../../options/get-party-form-cake-options', () => ({
    getPartyFormCakeOptions: getCakeOptions,
    getStockedPartyFormCakeOptions: getStockedCakeOptions,
}))
vi.mock('../../options/get-party-form-take-home-options', () => ({
    getPartyFormTakeHomeOptions: getTakeHomeOptions,
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))
vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: { getPartyBooking } }))
vi.mock('@/integrations/sanity/sanity.client', () => ({
    SanityClient: {
        getInstance: async () => ({
            getBirthdayPartyBookingCatalogue: getCatalogue,
            getBirthdayPartyFormImages: getImages,
        }),
    },
}))

// 10:00am Saturday 14 November in Melbourne (AEDT)
const partyDate = new Date('2026-11-13T23:00:00.000Z')

const catalogue: BirthdayPartyBookingCatalogue = {
    creations: [
        { key: 'studioSlime', name: 'Studio Slime', status: 'active', legacyLabels: [], bookingChannels: ['studio'] },
        { key: 'mobileSlime', name: 'Mobile Slime', status: 'active', legacyLabels: [], bookingChannels: ['mobile'] },
        {
            key: 'sharedSlime',
            name: 'Shared Slime',
            status: 'active',
            legacyLabels: [],
            bookingChannels: ['studio', 'mobile'],
        },
        { key: 'retiredSlime', name: 'Retired Slime', status: 'retired', legacyLabels: [], bookingChannels: [] },
    ],
    packages: [
        {
            key: 'slime',
            name: 'Slime',
            status: 'active',
            position: 1,
            creations: [
                { key: 'studioSlime' },
                { key: 'mobileSlime' },
                { key: 'sharedSlime' },
                { key: 'retiredSlime' },
            ],
        },
        { key: 'science', name: 'Science', status: 'active', position: 2, creations: [{ key: 'mobileSlime' }] },
    ],
}

const takeHomeOptions = { takeHomeBags: [], products: [], minimumQuantity: 12 }

const cakeOptions = {
    designs: [{ id: 'rainbow', name: 'Rainbow Ice-Cream Cake', imageUrl: null }],
    flavours: [{ id: 'vanilla', name: 'Vanilla', imageUrl: null }],
    minFlavours: 1,
    maxFlavours: 2,
}

describe('party form configuration with creation-owned availability', () => {
    beforeEach(() => {
        getAdditions.mockReset().mockResolvedValue([])
        getCakeOptions.mockReset().mockResolvedValue(cakeOptions)
        getTakeHomeOptions.mockReset().mockResolvedValue(takeHomeOptions)
    })

    it.each([
        ['studio', ['studioSlime', 'sharedSlime'], ['slime']],
        ['mobile', ['mobileSlime', 'sharedSlime'], ['slime', 'science']],
    ] as const)('returns %s choices and their photos in Website card order', async (type, choices, packages) => {
        getPartyBooking.mockResolvedValue({
            dateTime: partyDate,
            type,
            location: 'malvern',
            partyLength: '1.5',
            parentFirstName: 'Alex',
            parentLastName: 'Smith',
            childName: 'Charlie',
            childAge: '7',
            includesFood: true,
        })
        getCatalogue.mockResolvedValue(catalogue)
        getImages.mockResolvedValue(
            catalogue.packages.map((partyPackage) => ({
                key: partyPackage.key,
                // The catalogue is deduplicated; presentation may still have repeated cards.
                creations: [...partyPackage.creations, partyPackage.creations[0]].map((creation, index) => ({
                    key: creation.key,
                    image: { url: `https://images.example.com/${partyPackage.key}/${index}.jpg`, alt: creation.key },
                })),
            }))
        )

        const config = await getPartyFormConfig('booking-id')

        expect(config.packages.map((partyPackage) => partyPackage.key)).toEqual(packages)
        expect(config.packages[0].creations.map((creation) => creation.key)).toEqual(choices)
        expect(config.packages[0].creations[0].image?.url).toBe(
            `https://images.example.com/slime/${type === 'studio' ? 0 : 1}.jpg`
        )
        expect(
            config.packages.flatMap((partyPackage) => partyPackage.creations).every((creation) => creation.image)
        ).toBe(true)
    })

    it('offers Square additions to studio parties only, and still loads when Square fails', async () => {
        const additions = [{ key: 'wedges', name: 'Wedges', description: null, imageUrl: null, priceCents: 3000 }]
        getCatalogue.mockResolvedValue(catalogue)
        getImages.mockResolvedValue([])
        getAdditions.mockResolvedValue(additions)

        getPartyBooking.mockResolvedValue({
            dateTime: partyDate,
            type: 'studio',
            location: 'malvern',
            partyLength: '1.5',
            childAge: 7,
        })
        expect((await getPartyFormConfig('booking-id')).additions).toEqual(additions)
        expect(getAdditions).toHaveBeenCalledWith('malvern')

        getAdditions.mockRejectedValue(new Error('Square is down'))
        expect((await getPartyFormConfig('booking-id')).additions).toEqual([])

        getAdditions.mockClear()
        getPartyBooking.mockResolvedValue({
            dateTime: partyDate,
            type: 'mobile',
            location: 'malvern',
            partyLength: '1',
            childAge: 7,
        })
        expect((await getPartyFormConfig('booking-id')).additions).toEqual([])
        expect(getAdditions).not.toHaveBeenCalled()
    })

    it('offers cakes with Square designs and flavours, and turns cake ordering off when Square fails', async () => {
        getCatalogue.mockResolvedValue(catalogue)
        getImages.mockResolvedValue([])
        getPartyBooking.mockResolvedValue({
            dateTime: partyDate,
            type: 'studio',
            location: 'malvern',
            partyLength: '1.5',
            childAge: 7,
        })

        expect(await getPartyFormConfig('booking-id')).toMatchObject({ cakeOptions })
        expect(getCakeOptions).toHaveBeenCalledWith('malvern')

        getCakeOptions.mockRejectedValue(new Error('Square is down'))
        expect(await getPartyFormConfig('booking-id')).toMatchObject({ cakeOptions: null })
    })

    it('offers studio-stock cakes at Werribee and Geelong, and no cake step when none are in stock', async () => {
        getCatalogue.mockResolvedValue(catalogue)
        getImages.mockResolvedValue([])
        getPartyBooking.mockResolvedValue({
            dateTime: partyDate,
            type: 'studio',
            location: 'werribee',
            partyLength: '1.5',
            childAge: 7,
        })
        getStockedCakeOptions.mockResolvedValue(cakeOptions)

        expect(await getPartyFormConfig('booking-id')).toMatchObject({ cakeSource: 'studio-stock', cakeOptions })
        expect(getStockedCakeOptions).toHaveBeenCalledWith('werribee')
        expect(getCakeOptions).not.toHaveBeenCalled()

        getStockedCakeOptions.mockResolvedValue({ ...cakeOptions, designs: [] })
        expect(await getPartyFormConfig('booking-id')).toMatchObject({ cakeOptions: null })
    })

    it('says where and when the party is, in Melbourne time, for parents to check', async () => {
        getCatalogue.mockResolvedValue(catalogue)
        getImages.mockResolvedValue([])
        getPartyBooking.mockResolvedValue({
            dateTime: partyDate,
            type: 'studio',
            location: 'werribee',
            partyLength: '1.5',
            childAge: 7,
        })
        expect((await getPartyFormConfig('booking-id')).party).toEqual({
            date: 'Saturday 14 November',
            time: '10:00am – 11:30am',
            where: 'Fizz Kidz Werribee, ' + getStudioAddress('werribee'),
        })

        getPartyBooking.mockResolvedValue({
            dateTime: partyDate,
            type: 'mobile',
            location: 'malvern',
            partyLength: '1',
            childAge: 7,
            address: '12 Party Lane, Malvern',
        })
        expect((await getPartyFormConfig('booking-id')).party).toEqual({
            date: 'Saturday 14 November',
            time: '10:00am – 11:00am',
            where: '12 Party Lane, Malvern',
        })
    })

    it('reports a booking that no longer exists as not found rather than a server error', async () => {
        getPartyBooking.mockRejectedValue(new DocumentNotFoundError('bookings/missing', 'missing'))
        const error = await getPartyFormConfig('missing').catch((err: unknown) => err)
        expect(error).toMatchObject({ code: 'NOT_FOUND' })

        getPartyBooking.mockRejectedValue(new Error('Firestore is down'))
        await expect(getPartyFormConfig('booking-id')).rejects.toThrow('Firestore is down')
    })

    it('offers take-home goodies from Square, and loads without them when Square fails', async () => {
        getCatalogue.mockResolvedValue(catalogue)
        getImages.mockResolvedValue([])
        getPartyBooking.mockResolvedValue({
            dateTime: partyDate,
            type: 'mobile',
            location: 'malvern',
            partyLength: '1',
            childAge: 7,
        })

        expect((await getPartyFormConfig('booking-id')).takeHomeOptions).toEqual(takeHomeOptions)
        expect(getTakeHomeOptions).toHaveBeenCalledWith('malvern')

        getTakeHomeOptions.mockRejectedValue(new Error('Square is down'))
        expect((await getPartyFormConfig('booking-id')).takeHomeOptions).toBeNull()
    })
})
