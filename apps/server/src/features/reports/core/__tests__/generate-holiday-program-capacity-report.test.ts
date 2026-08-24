import { deepStrictEqual, strictEqual } from 'assert'

import { afterEach, beforeAll, beforeEach, describe, it, vi } from 'vite-plus/test'

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
    appointmentsByClass = new Map<number, Array<Partial<AcuityTypes.Api.Appointment>>>()
    searchForAppointmentsInputs: AcuityTypes.Client.FetchAppointmentsParams[] = []

    async getClasses(
        _appointmentTypeIds: number[],
        _includeUnavailable: boolean,
        minDate?: number
    ): Promise<MockClass[]> {
        return this.classes.filter((klass) => !minDate || new Date(klass.time).getTime() >= minDate)
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
            .flatMap((klass) => {
                const appointments: Array<Partial<AcuityTypes.Api.Appointment>> =
                    this.appointmentsByClass.get(klass.id) ??
                    Array.from({ length: this.appointmentCountsByClass.get(klass.id) ?? 0 }, (_, index) => ({
                        id: klass.id * 1000 + index,
                        appointmentTypeID: klass.appointmentTypeID,
                        calendarID: klass.calendarID,
                        classID: klass.id,
                    }))

                return appointments
                    .filter((appointment) => input.showAll || appointment.canceled !== true)
                    .map((appointment) => ({
                        appointmentTypeID: klass.appointmentTypeID,
                        calendarID: klass.calendarID,
                        classID: klass.id,
                        ...appointment,
                    }))
            }) as AcuityTypes.Api.Appointment[]
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
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-01T12:00:00+11:00'))
        mockAcuityClient.classes = []
        mockAcuityClient.appointmentCountsByClass.clear()
        mockAcuityClient.appointmentsByClass.clear()
        mockAcuityClient.searchForAppointmentsInputs = []
        mergeAcuityWithSanity = async (classes) => classes
    })

    afterEach(() => {
        vi.useRealTimers()
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

    it('preserves later upcoming periods in the capacity report', async () => {
        mockAcuityClient.classes = [
            createClass({
                id: 1,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 10,
                time: '2026-04-01T09:00:00+10:00',
            }),
            createClass({
                id: 2,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 20,
                time: '2026-05-01T09:00:00+10:00',
            }),
        ]
        mockAcuityClient.appointmentCountsByClass.set(1, 2)
        mockAcuityClient.appointmentCountsByClass.set(2, 3)

        const result = await generateHolidayProgramCapacityReport({ studio: 'balwyn' })

        deepStrictEqual(
            result.studios[0].classes.map((klass) => klass.classId),
            [1, 2]
        )
        deepStrictEqual(result.overall, {
            bookedSpots: 5,
            totalCapacity: 35,
            slotsAvailable: 30,
            utilisationPercentage: (5 / 35) * 100,
        })
        strictEqual(mockAcuityClient.searchForAppointmentsInputs[0].maxDate, '2026-05-01')
    })

    it('compares booking pace at the same number of days before each program starts', async () => {
        mockAcuityClient.classes = [
            createClass({
                id: 10,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 5,
                time: '2026-06-29T10:00:00+10:00',
            }),
            createClass({
                id: 20,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 7,
                time: '2026-09-21T10:00:00+10:00',
            }),
        ]
        mockAcuityClient.appointmentsByClass.set(10, [
            { id: 1001, datetimeCreated: '2026-05-20T10:00:00+10:00' },
            { id: 1002, datetimeCreated: '2026-05-31T10:00:00+10:00', canceled: true },
            { id: 1003, datetimeCreated: '2026-06-01T13:00:00+10:00' },
            { id: 1004, datetimeCreated: '2026-06-10T10:00:00+10:00' },
            { id: 1005, datetimeCreated: '2026-06-15T10:00:00+10:00' },
            { id: 1006, datetimeCreated: '2026-06-20T10:00:00+10:00' },
        ])
        mockAcuityClient.appointmentsByClass.set(20, [
            { id: 2001, datetimeCreated: '2026-08-01T10:00:00+10:00' },
            { id: 2002, datetimeCreated: '2026-08-24T11:00:00+10:00' },
            { id: 2003, datetimeCreated: '2026-08-24T13:00:00+10:00' },
        ])

        vi.setSystemTime(new Date('2026-08-24T12:00:00+10:00'))
        const result = await generateHolidayProgramCapacityReport({
            studio: 'balwyn',
            comparePreviousPeriod: true,
        })

        strictEqual(result.comparison?.available, true)
        strictEqual(result.comparison?.daysBeforeStart, 28)
        strictEqual(result.comparison?.daysIntoPeriod, 0)
        deepStrictEqual(result.comparison?.currentPeriod, {
            startDate: '2026-09-21',
            endDate: '2026-09-21',
        })
        deepStrictEqual(result.comparison?.previousPeriod, {
            startDate: '2026-06-29',
            endDate: '2026-06-29',
            cutoffDate: '2026-06-01',
        })
        deepStrictEqual(result.comparison?.current, {
            bookingsMade: 2,
            totalCapacity: 10,
            utilisationPercentage: 20,
        })
        deepStrictEqual(result.comparison?.previous, {
            bookingsMade: 2,
            totalCapacity: 10,
            utilisationPercentage: 20,
        })
        strictEqual(result.comparison?.percentagePointDifference, 0)
    })

    it('compares the complete program at the matching day after it starts', async () => {
        mockAcuityClient.classes = [
            createClass({
                id: 10,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 0,
                time: '2026-06-01T10:00:00+10:00',
            }),
            createClass({
                id: 11,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 5,
                time: '2026-06-08T10:00:00+10:00',
            }),
            createClass({
                id: 20,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 0,
                time: '2026-09-07T10:00:00+10:00',
            }),
            createClass({
                id: 21,
                calendarID: AcuityConstants.StoreCalendars.balwyn,
                slotsAvailable: 5,
                time: '2026-09-14T10:00:00+10:00',
            }),
        ]
        mockAcuityClient.appointmentsByClass.set(
            10,
            Array.from({ length: 10 }, (_, index) => ({
                id: 1000 + index,
                datetimeCreated: '2026-05-01T10:00:00+10:00',
            }))
        )
        mockAcuityClient.appointmentsByClass.set(
            11,
            Array.from({ length: 5 }, (_, index) => ({
                id: 1100 + index,
                datetimeCreated: '2026-06-08T09:00:00+10:00',
            }))
        )
        mockAcuityClient.appointmentsByClass.set(
            20,
            Array.from({ length: 10 }, (_, index) => ({
                id: 2000 + index,
                datetimeCreated: '2026-08-01T10:00:00+10:00',
            }))
        )
        mockAcuityClient.appointmentsByClass.set(
            21,
            Array.from({ length: 5 }, (_, index) => ({
                id: 2100 + index,
                datetimeCreated: '2026-09-14T09:00:00+10:00',
            }))
        )

        vi.setSystemTime(new Date('2026-09-14T12:00:00+10:00'))
        const result = await generateHolidayProgramCapacityReport({
            studio: 'balwyn',
            comparePreviousPeriod: true,
        })

        strictEqual(result.comparison?.available, true)
        strictEqual(result.comparison?.daysBeforeStart, 0)
        strictEqual(result.comparison?.daysIntoPeriod, 8)
        deepStrictEqual(result.comparison?.currentPeriod, {
            startDate: '2026-09-07',
            endDate: '2026-09-14',
        })
        deepStrictEqual(result.comparison?.previousPeriod, {
            startDate: '2026-06-01',
            endDate: '2026-06-08',
            cutoffDate: '2026-06-08',
        })
        deepStrictEqual(result.comparison?.current, {
            bookingsMade: 15,
            totalCapacity: 20,
            utilisationPercentage: 75,
        })
        deepStrictEqual(result.comparison?.previous, {
            bookingsMade: 15,
            totalCapacity: 20,
            utilisationPercentage: 75,
        })
    })
})
