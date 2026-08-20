import { deepStrictEqual, strictEqual } from 'assert'

import { beforeAll, beforeEach, describe, it, vi } from 'vite-plus/test'

import { AcuityConstants, STUDIOS } from '@fizz-kidz/core'
import type { AcuityTypes } from '@fizz-kidz/core'

import type * as HolidayProgramCapacityReportModule from '../generate-holiday-program-capacity-report'

type MockClass = AcuityTypes.Api.Class & { title?: string }

const createClass = (input: {
    id: number
    calendarID: number
    slotsAvailable: number
    time: string
    name?: string
}): MockClass =>
    ({
        appointmentTypeID: AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM,
        calendar: 'Calendar',
        description: '',
        duration: 180,
        price: '95',
        name: input.name ?? 'Holiday Program',
        ...input,
    }) as MockClass

class MockAcuityClient {
    classes: MockClass[] = []
    appointmentCountsByClass = new Map<number, number>()
    searchForAppointmentsInputs: AcuityTypes.Client.FetchAppointmentsParams[] = []

    async getClasses(): Promise<MockClass[]> {
        return this.classes
    }

    async searchForAppointments(
        input: AcuityTypes.Client.FetchAppointmentsParams
    ): Promise<AcuityTypes.Api.Appointment[]> {
        this.searchForAppointmentsInputs.push(input)

        return this.classes
            .filter((klass) => klass.appointmentTypeID === input.appointmentTypeId)
            .filter((klass) => !input.calendarId || klass.calendarID === input.calendarId)
            .filter((klass) => {
                const date = klass.time.split('T')[0]
                return (!input.minDate || date >= input.minDate) && (!input.maxDate || date <= input.maxDate)
            })
            .flatMap((klass) =>
                Array.from({ length: this.appointmentCountsByClass.get(klass.id) ?? 0 }, (_, index) => ({
                    id: klass.id * 1000 + index,
                    appointmentTypeID: klass.appointmentTypeID,
                    calendarID: klass.calendarID,
                    classID: klass.id,
                }))
            ) as AcuityTypes.Api.Appointment[]
    }
}

const mockAcuityClient = new MockAcuityClient()
let mergeAcuityWithSanity = async (classes: MockClass[]) => classes
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/acuity/acuity.client', () => ({
    AcuityClient: {
        getInstance: async () => mockAcuityClient,
    },
}))
vi.mock('@/integrations/acuity/core/merge-sanity-with-acuity', () => ({
    mergeAcuityWithSanity: (classes: MockClass[]) => mergeAcuityWithSanity(classes),
}))

let generateHolidayProgramCapacityReport: typeof HolidayProgramCapacityReportModule.generateHolidayProgramCapacityReport
let generateHolidayProgramCapacityReportInputSchema: typeof HolidayProgramCapacityReportModule.generateHolidayProgramCapacityReportInputSchema

beforeAll(async () => {
    const reportModule = await import('../generate-holiday-program-capacity-report')
    generateHolidayProgramCapacityReport = reportModule.generateHolidayProgramCapacityReport
    generateHolidayProgramCapacityReportInputSchema = reportModule.generateHolidayProgramCapacityReportInputSchema
})

describe('generateHolidayProgramCapacityReport', () => {
    beforeEach(() => {
        mockAcuityClient.classes = []
        mockAcuityClient.appointmentCountsByClass.clear()
        mockAcuityClient.searchForAppointmentsInputs = []
        mergeAcuityWithSanity = async (classes) => classes
    })

    it('calculates class and studio capacity for one studio', async () => {
        mockAcuityClient.classes = [
            createClass({
                id: 1,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 20,
                time: '2026-04-01T09:00:00+10:00',
            }),
            createClass({
                id: 2,
                calendarID: AcuityConstants.StoreCalendars.cheltenham,
                slotsAvailable: 15,
                time: '2026-04-01T09:00:00+10:00',
            }),
        ]
        mockAcuityClient.appointmentCountsByClass.set(1, 5)
        mockAcuityClient.appointmentCountsByClass.set(2, 10)

        const result = await generateHolidayProgramCapacityReport({ studio: 'balwyn' })

        strictEqual(result.studio, 'balwyn')
        strictEqual(result.studios.length, 1)
        deepStrictEqual(mockAcuityClient.searchForAppointmentsInputs, [
            {
                appointmentTypeId: AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM,
                calendarId: AcuityConstants.StoreCalendars.balwyn,
                minDate: '2026-04-01',
                maxDate: '2026-04-01',
                maxResults: 10000,
            },
        ])
        deepStrictEqual(result.overall, {
            bookedSpots: 5,
            totalCapacity: 25,
            slotsAvailable: 20,
            utilisationPercentage: 20,
        })
        deepStrictEqual(result.studios[0], {
            studio: 'balwyn',
            bookedSpots: 5,
            totalCapacity: 25,
            slotsAvailable: 20,
            utilisationPercentage: 20,
            classes: [
                {
                    classId: 1,
                    appointmentTypeId: AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM,
                    calendarId: AcuityConstants.StoreCalendars.balwyn,
                    studio: 'balwyn',
                    name: 'Holiday Program',
                    time: '2026-04-01T09:00:00+10:00',
                    bookedSpots: 5,
                    totalCapacity: 25,
                    slotsAvailable: 20,
                    utilisationPercentage: 20,
                },
            ],
        })
    })

    it('returns all studios and an overall summary for master', async () => {
        mockAcuityClient.classes = [
            createClass({
                id: 1,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 20,
                time: '2026-04-01T09:00:00+10:00',
            }),
            createClass({
                id: 2,
                calendarID: AcuityConstants.StoreCalendars.cheltenham,
                slotsAvailable: 5,
                time: '2026-04-02T09:00:00+10:00',
            }),
        ]
        mockAcuityClient.appointmentCountsByClass.set(1, 5)
        mockAcuityClient.appointmentCountsByClass.set(2, 15)

        const result = await generateHolidayProgramCapacityReport({ studio: 'master' })

        strictEqual(result.studios.length, STUDIOS.length)
        deepStrictEqual(mockAcuityClient.searchForAppointmentsInputs, [
            {
                appointmentTypeId: AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM,
                calendarId: undefined,
                minDate: '2026-04-01',
                maxDate: '2026-04-02',
                maxResults: 10000,
            },
        ])
        deepStrictEqual(result.overall, {
            bookedSpots: 20,
            totalCapacity: 45,
            slotsAvailable: 25,
            utilisationPercentage: (20 / 45) * 100,
        })
        deepStrictEqual(
            result.studios
                .filter((studioResult) => studioResult.totalCapacity > 0)
                .map(({ studio, bookedSpots, totalCapacity, slotsAvailable }) => ({
                    studio,
                    bookedSpots,
                    totalCapacity,
                    slotsAvailable,
                })),
            [
                { studio: 'balwyn', bookedSpots: 5, totalCapacity: 25, slotsAvailable: 20 },
                { studio: 'cheltenham', bookedSpots: 15, totalCapacity: 20, slotsAvailable: 5 },
            ]
        )
    })

    it('validates the trpc input schema', () => {
        strictEqual(generateHolidayProgramCapacityReportInputSchema.safeParse({ studio: 'master' }).success, true)
        strictEqual(generateHolidayProgramCapacityReportInputSchema.safeParse({ studio: 'balwyn' }).success, true)
        strictEqual(generateHolidayProgramCapacityReportInputSchema.safeParse({ studio: 'richmond' }).success, false)
    })

    it('uses the merged Sanity title when available', async () => {
        mockAcuityClient.classes = [
            createClass({
                id: 1,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 20,
                time: '2026-04-01T09:00:00+10:00',
            }),
        ]
        mergeAcuityWithSanity = async (classes) => classes.map((klass) => ({ ...klass, title: 'Slime Spectacular' }))

        const result = await generateHolidayProgramCapacityReport({ studio: 'balwyn' })

        strictEqual(result.studios[0].classes[0].title, 'Slime Spectacular')
    })
})
