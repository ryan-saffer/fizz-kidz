import { deepStrictEqual, rejects, strictEqual } from 'assert'

import { mockDatabaseClient, resetDatabaseClientMock } from '@test-support/database-client.mock'
import { afterEach, describe, it } from 'vite-plus/test'

import { STUDIOS, type FirestoreBooking, type StudioOrMaster } from '@fizz-kidz/core'

import { generateCapacityReport, generateCapacityReportInputSchema } from '../generate-capacity-report'

type CapacityReportQueryInput = {
    startDate: Date
    endDate: Date
    studio: StudioOrMaster
}

const createBooking = (
    location: FirestoreBooking['location'],
    type: FirestoreBooking['type'],
    date = '2026-07-18T10:00:00+10:00'
): FirestoreBooking =>
    ({
        location,
        type,
        dateTime: { toDate: () => new Date(date) },
    }) as FirestoreBooking

describe('generateCapacityReport', () => {
    afterEach(() => {
        resetDatabaseClientMock()
    })

    it('calculates studio-only utilisation for a single studio and ignores mobile parties', async () => {
        mockDatabaseClient.getPartyBookingsForCapacityReport = async () => [
            createBooking('balwyn', 'studio'),
            createBooking('balwyn', 'studio'),
            createBooking('balwyn', 'mobile'),
        ]

        const result = await generateCapacityReport({
            startDate: '2026-07-17',
            endDate: '2026-07-19',
            studio: 'balwyn',
            partyTypes: ['studio'],
        })

        const slots = { bookedSlots: 2, availableSlots: 9, utilisationPercentage: (2 / 9) * 100 }
        const summary = { ...slots, byPartyType: [{ type: 'studio', ...slots }] }

        deepStrictEqual(result, {
            startDate: '2026-07-17',
            endDate: '2026-07-19',
            studio: 'balwyn',
            partyTypes: ['studio'],
            overall: summary,
            studios: [
                {
                    studio: 'balwyn',
                    ...summary,
                    weeks: [{ startDate: '2026-07-17', endDate: '2026-07-19', ...summary }],
                },
            ],
            weeks: [
                {
                    startDate: '2026-07-17',
                    endDate: '2026-07-19',
                    ...summary,
                    studios: [{ studio: 'balwyn', ...summary }],
                },
            ],
        })
    })

    it('includes mobile parties and capacity when requested', async () => {
        mockDatabaseClient.getPartyBookingsForCapacityReport = async () => [
            createBooking('balwyn', 'studio'),
            createBooking('balwyn', 'mobile'),
        ]

        const mobileOnly = await generateCapacityReport({
            startDate: '2026-07-17',
            endDate: '2026-07-19',
            studio: 'balwyn',
            partyTypes: ['mobile'],
        })
        deepStrictEqual(mobileOnly.overall, {
            bookedSlots: 1,
            availableSlots: 2,
            utilisationPercentage: 50,
            byPartyType: [{ type: 'mobile', bookedSlots: 1, availableSlots: 2, utilisationPercentage: 50 }],
        })

        const both = await generateCapacityReport({
            startDate: '2026-07-17',
            endDate: '2026-07-19',
            studio: 'balwyn',
            partyTypes: ['studio', 'mobile'],
        })
        deepStrictEqual(both.overall, {
            bookedSlots: 2,
            availableSlots: 11,
            utilisationPercentage: (2 / 11) * 100,
            byPartyType: [
                { type: 'studio', bookedSlots: 1, availableSlots: 9, utilisationPercentage: (1 / 9) * 100 },
                { type: 'mobile', bookedSlots: 1, availableSlots: 2, utilisationPercentage: 50 },
            ],
        })
    })

    it('returns a row for each studio when reporting on master', async () => {
        mockDatabaseClient.getPartyBookingsForCapacityReport = async () => [
            createBooking('balwyn', 'studio', '2026-07-04T10:00:00+10:00'),
            createBooking('balwyn', 'studio', '2026-07-05T10:00:00+10:00'),
            createBooking('kingsville', 'studio', '2026-07-05T10:00:00+10:00'),
            createBooking('cheltenham', 'mobile', '2026-07-05T10:00:00+10:00'),
        ]

        const result = await generateCapacityReport({
            startDate: '2026-07-04',
            endDate: '2026-07-05',
            studio: 'master',
            partyTypes: ['studio'],
        })

        strictEqual(result.studios.length, STUDIOS.length)
        deepStrictEqual(
            result.studios
                .filter((studioResult) => studioResult.bookedSlots > 0)
                .map((studioResult) => ({
                    studio: studioResult.studio,
                    bookedSlots: studioResult.bookedSlots,
                    availableSlots: studioResult.availableSlots,
                    utilisationPercentage: studioResult.utilisationPercentage,
                })),
            [
                {
                    studio: 'balwyn',
                    bookedSlots: 2,
                    availableSlots: 5,
                    utilisationPercentage: 40,
                },
                {
                    studio: 'kingsville',
                    bookedSlots: 1,
                    availableSlots: 5,
                    utilisationPercentage: 20,
                },
            ]
        )
        deepStrictEqual(result.overall, {
            bookedSlots: 3,
            availableSlots: 5 * STUDIOS.length,
            utilisationPercentage: (3 / (5 * STUDIOS.length)) * 100,
            byPartyType: [
                {
                    type: 'studio',
                    bookedSlots: 3,
                    availableSlots: 5 * STUDIOS.length,
                    utilisationPercentage: (3 / (5 * STUDIOS.length)) * 100,
                },
            ],
        })
    })

    it('sums each party type across studios for master totals', async () => {
        mockDatabaseClient.getPartyBookingsForCapacityReport = async () => [
            createBooking('balwyn', 'studio', '2026-07-18T10:00:00+10:00'),
            createBooking('kingsville', 'studio', '2026-07-18T10:00:00+10:00'),
            createBooking('cheltenham', 'mobile', '2026-07-18T10:00:00+10:00'),
        ]

        const result = await generateCapacityReport({
            startDate: '2026-07-18',
            endDate: '2026-07-19',
            studio: 'master',
            partyTypes: ['studio', 'mobile'],
        })

        const expected = {
            bookedSlots: 3,
            availableSlots: 10 * STUDIOS.length,
            utilisationPercentage: (3 / (10 * STUDIOS.length)) * 100,
            byPartyType: [
                {
                    type: 'studio',
                    bookedSlots: 2,
                    availableSlots: 8 * STUDIOS.length,
                    utilisationPercentage: (2 / (8 * STUDIOS.length)) * 100,
                },
                {
                    type: 'mobile',
                    bookedSlots: 1,
                    availableSlots: 2 * STUDIOS.length,
                    utilisationPercentage: (1 / (2 * STUDIOS.length)) * 100,
                },
            ],
        }
        deepStrictEqual(result.overall, expected)
        const [week] = result.weeks
        deepStrictEqual(
            {
                bookedSlots: week.bookedSlots,
                availableSlots: week.availableSlots,
                utilisationPercentage: week.utilisationPercentage,
                byPartyType: week.byPartyType,
            },
            expected
        )
    })

    it('groups bookings and capacity into partial and complete Monday-to-Sunday weeks', async () => {
        mockDatabaseClient.getPartyBookingsForCapacityReport = async () => [
            createBooking('balwyn', 'studio', '2026-07-19T10:00:00+10:00'),
            createBooking('balwyn', 'studio', '2026-07-24T10:00:00+10:00'),
            createBooking('balwyn', 'studio', '2026-07-26T10:00:00+10:00'),
        ]

        const result = await generateCapacityReport({
            startDate: '2026-07-17',
            endDate: '2026-07-26',
            studio: 'balwyn',
            partyTypes: ['studio'],
        })

        deepStrictEqual(
            result.weeks.map((week) => ({
                startDate: week.startDate,
                endDate: week.endDate,
                bookedSlots: week.bookedSlots,
                availableSlots: week.availableSlots,
                utilisationPercentage: week.utilisationPercentage,
            })),
            [
                {
                    startDate: '2026-07-17',
                    endDate: '2026-07-19',
                    bookedSlots: 1,
                    availableSlots: 9,
                    utilisationPercentage: (1 / 9) * 100,
                },
                {
                    startDate: '2026-07-20',
                    endDate: '2026-07-26',
                    bookedSlots: 2,
                    availableSlots: 9,
                    utilisationPercentage: (2 / 9) * 100,
                },
            ]
        )
    })

    it('queries the inclusive date range by using the next day as the exclusive end', async () => {
        const queryInputs: CapacityReportQueryInput[] = []
        mockDatabaseClient.getPartyBookingsForCapacityReport = async (input) => {
            queryInputs.push(input)
            return []
        }

        await generateCapacityReport({
            startDate: '2026-07-03',
            endDate: '2026-07-12',
            studio: 'balwyn',
            partyTypes: ['studio'],
        })

        const queryInput = queryInputs[0]
        strictEqual(queryInput.studio, 'balwyn')
        strictEqual(
            queryInput.startDate.toLocaleString('en-au', {
                timeZone: 'Australia/Melbourne',
            }),
            '03/07/2026, 12:00:00 am'
        )
        strictEqual(
            queryInput.endDate.toLocaleString('en-au', {
                timeZone: 'Australia/Melbourne',
            }),
            '13/07/2026, 12:00:00 am'
        )
    })

    it('rejects invalid report inputs', async () => {
        await rejects(
            generateCapacityReport({
                startDate: '2026-07-30',
                endDate: '2026-07-01',
                studio: 'balwyn',
                partyTypes: ['studio'],
            })
        )

        await rejects(
            generateCapacityReport({
                startDate: 'not-a-date',
                endDate: '2026-07-01',
                studio: 'balwyn',
                partyTypes: ['studio'],
            })
        )

        await rejects(
            generateCapacityReport({
                startDate: '2026-07-02',
                endDate: '2026-07-30',
                studio: 'balwyn',
                partyTypes: ['studio'],
            })
        )
    })

    it('supports the zero-capacity days through the end of 2026', async () => {
        mockDatabaseClient.getPartyBookingsForCapacityReport = async () => []

        const result = await generateCapacityReport({
            startDate: '2026-12-28',
            endDate: '2026-12-31',
            studio: 'balwyn',
            partyTypes: ['studio'],
        })

        deepStrictEqual(result.overall, {
            bookedSlots: 0,
            availableSlots: 0,
            utilisationPercentage: 0,
            byPartyType: [{ type: 'studio', bookedSlots: 0, availableSlots: 0, utilisationPercentage: 0 }],
        })
    })

    it('validates the trpc input schema', () => {
        strictEqual(
            generateCapacityReportInputSchema.safeParse({
                startDate: '2026-07-03',
                endDate: '2026-07-30',
                studio: 'master',
                partyTypes: ['studio'],
            }).success,
            true
        )

        strictEqual(
            generateCapacityReportInputSchema.safeParse({
                startDate: '2026-07-03',
                endDate: '2026-07-30',
                studio: 'richmond',
                partyTypes: ['studio'],
            }).success,
            false
        )

        strictEqual(
            generateCapacityReportInputSchema.safeParse({
                startDate: '2026-07-03T12:00:00+10:00',
                endDate: '2026-07-30',
                studio: 'balwyn',
                partyTypes: ['studio'],
            }).success,
            false
        )

        strictEqual(
            generateCapacityReportInputSchema.safeParse({
                startDate: '2026-07-03',
                endDate: '2026-07-30',
                studio: 'balwyn',
                partyTypes: [],
            }).success,
            false
        )
    })
})
