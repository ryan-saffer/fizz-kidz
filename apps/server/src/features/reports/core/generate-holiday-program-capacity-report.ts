import { DateTime } from 'luxon'
import { z } from 'zod'

import { AcuityConstants, STUDIOS } from '@fizz-kidz/core'
import type { AcuityTypes, Studio, StudioOrMaster } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { AcuityClient } from '@/integrations/acuity/acuity.client'
import { mergeAcuityWithSanity } from '@/integrations/acuity/core/merge-sanity-with-acuity'

const studioOrMasterSchema = z.custom<StudioOrMaster>(
    (value) => typeof value === 'string' && (value === 'master' || STUDIOS.includes(value as Studio))
)

export const generateHolidayProgramCapacityReportInputSchema = z.object({
    studio: studioOrMasterSchema,
    comparePreviousPeriod: z.boolean().optional(),
})

export type GenerateHolidayProgramCapacityReportInput = z.infer<typeof generateHolidayProgramCapacityReportInputSchema>

export type HolidayProgramCapacityReportResponse = {
    studio: StudioOrMaster
    generatedAt: string
    overall: HolidayProgramCapacitySummary
    studios: HolidayProgramCapacityStudioResult[]
    comparison?: HolidayProgramBookingPaceComparison
}

export type HolidayProgramBookingPaceComparison = {
    available: boolean
    approximate: true
    daysBeforeStart: number
    currentPeriod: HolidayProgramPeriod
    previousPeriod?: HolidayProgramPeriod & { cutoffDate: string }
    current?: HolidayProgramBookingPaceSummary
    previous?: HolidayProgramBookingPaceSummary
    percentagePointDifference?: number
    studios?: HolidayProgramBookingPaceStudioResult[]
    excludedAppointments: number
    unavailableReason?: string
}

export type HolidayProgramPeriod = {
    startDate: string
    endDate: string
}

export type HolidayProgramBookingPaceSummary = {
    bookingsMade: number
    totalCapacity: number
    utilisationPercentage: number
}

export type HolidayProgramBookingPaceStudioResult = {
    studio: Studio
    current: HolidayProgramBookingPaceSummary
    previous: HolidayProgramBookingPaceSummary
    percentagePointDifference: number
}

export type HolidayProgramCapacitySummary = {
    bookedSpots: number
    totalCapacity: number
    slotsAvailable: number
    utilisationPercentage: number
}

export type HolidayProgramCapacityStudioResult = HolidayProgramCapacitySummary & {
    studio: Studio
    classes: HolidayProgramCapacityClassResult[]
}

export type HolidayProgramCapacityClassResult = HolidayProgramCapacitySummary & {
    classId: number
    appointmentTypeId: number
    calendarId: number
    studio: Studio
    name: string
    title?: string
    time: string
}

const appointmentTypeIds =
    env === 'prod'
        ? [AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM]
        : [AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM]
const MAX_APPOINTMENT_RESULTS = 10000
const PROGRAM_PERIOD_BREAK_DAYS = 21
const COMPARISON_LOOKBACK_MONTHS = 12
const REPORT_TIME_ZONE = 'Australia/Melbourne'

type HolidayProgramClass = AcuityTypes.Api.Class & { title?: string }

export async function generateHolidayProgramCapacityReport(
    input: GenerateHolidayProgramCapacityReportInput
): Promise<HolidayProgramCapacityReportResponse> {
    const acuity = await AcuityClient.getInstance()
    const generatedAt = DateTime.now().setZone(REPORT_TIME_ZONE)
    const studios = input.studio === 'master' ? STUDIOS : [input.studio]
    const calendarIdsByStudio = new Map(
        Object.entries(AcuityConstants.StoreCalendars).map(([studio, id]) => [id, studio as Studio])
    )
    const allowedCalendarIds = new Set(studios.map((studio) => AcuityConstants.StoreCalendars[studio]))

    const upcomingClasses = (await mergeAcuityWithSanity(await acuity.getClasses(appointmentTypeIds, true, Date.now())))
        .filter((klass) => allowedCalendarIds.has(klass.calendarID))
        .filter((klass) => DateTime.fromISO(klass.time).toMillis() >= generatedAt.startOf('day').toMillis())
        .sort((a, b) => a.time.localeCompare(b.time))
    const classes = getProgramPeriods(upcomingClasses)[0] ?? []

    const allAppointmentsByClassId = await getAppointmentsByClassId({
        acuity,
        classes,
        calendarId: input.studio === 'master' ? undefined : AcuityConstants.StoreCalendars[input.studio],
        showAll: input.comparePreviousPeriod === true,
    })
    const appointmentsByClassId = getActiveAppointmentsByClassId(allAppointmentsByClassId)

    const classResults = classes.map((klass): HolidayProgramCapacityClassResult => {
        const bookedSpots = appointmentsByClassId.get(klass.id)?.length ?? 0
        const totalCapacity = bookedSpots + klass.slotsAvailable
        const studio = calendarIdsByStudio.get(klass.calendarID)!

        return {
            classId: klass.id,
            appointmentTypeId: klass.appointmentTypeID,
            calendarId: klass.calendarID,
            studio,
            name: klass.name,
            ...(klass.title ? { title: klass.title } : {}),
            time: klass.time,
            bookedSpots,
            totalCapacity,
            slotsAvailable: klass.slotsAvailable,
            utilisationPercentage: calculateUtilisation(bookedSpots, totalCapacity),
        }
    })

    const studioResults = studios.map((studio): HolidayProgramCapacityStudioResult => {
        const studioClasses = classResults.filter((klass) => klass.studio === studio)
        const summary = summarise(studioClasses)

        return {
            studio,
            ...summary,
            classes: studioClasses,
        }
    })

    const report: HolidayProgramCapacityReportResponse = {
        studio: input.studio,
        generatedAt: generatedAt.toISO()!,
        overall: summarise(studioResults),
        studios: studioResults,
    }

    if (input.comparePreviousPeriod && classes.length > 0) {
        report.comparison = await generateBookingPaceComparison({
            acuity,
            currentClasses: classes,
            currentAppointmentsByClassId: allAppointmentsByClassId,
            currentClassResults: classResults,
            generatedAt,
            studios,
            allowedCalendarIds,
            calendarId: input.studio === 'master' ? undefined : AcuityConstants.StoreCalendars[input.studio],
        })
    }

    return report
}

async function getAppointmentsByClassId({
    acuity,
    classes,
    calendarId,
    showAll = false,
}: {
    acuity: Awaited<ReturnType<typeof AcuityClient.getInstance>>
    classes: Array<AcuityTypes.Api.Class & { title?: string }>
    calendarId?: number
    showAll?: boolean
}) {
    const classIds = new Set(classes.map((klass) => klass.id))
    if (classIds.size === 0) return new Map<number, AcuityTypes.Api.Appointment[]>()

    const classAppointmentTypeIds = [...new Set(classes.map((klass) => klass.appointmentTypeID))]
    const dates = classes.map((klass) => klass.time.split('T')[0]).sort()
    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]
    const appointments = (
        await Promise.all(
            classAppointmentTypeIds.map((appointmentTypeId) =>
                acuity.searchForAppointments({
                    appointmentTypeId,
                    calendarId,
                    minDate,
                    maxDate,
                    maxResults: MAX_APPOINTMENT_RESULTS,
                    ...(showAll ? { showAll: true } : {}),
                })
            )
        )
    )
        .flat()
        .filter((appointment) => classIds.has(appointment.classID))

    return appointments.reduce((appointmentsByClassId, appointment) => {
        const existingAppointments = appointmentsByClassId.get(appointment.classID) ?? []
        appointmentsByClassId.set(appointment.classID, [...existingAppointments, appointment])
        return appointmentsByClassId
    }, new Map<number, AcuityTypes.Api.Appointment[]>())
}

function getActiveAppointmentsByClassId(appointmentsByClassId: Map<number, AcuityTypes.Api.Appointment[]>) {
    return new Map(
        [...appointmentsByClassId.entries()].map(([classId, appointments]) => [
            classId,
            appointments.filter((appointment) => appointment.canceled !== true),
        ])
    )
}

async function generateBookingPaceComparison({
    acuity,
    currentClasses,
    currentAppointmentsByClassId,
    currentClassResults,
    generatedAt,
    studios,
    allowedCalendarIds,
    calendarId,
}: {
    acuity: Awaited<ReturnType<typeof AcuityClient.getInstance>>
    currentClasses: HolidayProgramClass[]
    currentAppointmentsByClassId: Map<number, AcuityTypes.Api.Appointment[]>
    currentClassResults: HolidayProgramCapacityClassResult[]
    generatedAt: DateTime
    studios: Studio[]
    allowedCalendarIds: Set<number>
    calendarId?: number
}): Promise<HolidayProgramBookingPaceComparison> {
    const currentPeriod = getProgramPeriod(currentClasses)
    const currentStart = DateTime.fromISO(currentClasses[0].time).setZone(REPORT_TIME_ZONE)
    const daysBeforeStart = Math.max(
        0,
        Math.ceil(currentStart.startOf('day').diff(generatedAt.startOf('day'), 'days').days)
    )
    const unavailable = (unavailableReason: string): HolidayProgramBookingPaceComparison => ({
        available: false,
        approximate: true,
        daysBeforeStart,
        currentPeriod,
        excludedAppointments: 0,
        unavailableReason,
    })

    const comparisonMinDate = generatedAt.minus({ months: COMPARISON_LOOKBACK_MONTHS }).startOf('day').toMillis()
    const comparisonClasses = (await acuity.getClasses(appointmentTypeIds, true, comparisonMinDate))
        .filter((klass) => allowedCalendarIds.has(klass.calendarID))
        .filter((klass) => klass.time < currentClasses[0].time)
        .sort((a, b) => a.time.localeCompare(b.time))
    const previousClasses = getProgramPeriods(comparisonClasses).at(-1)

    if (!previousClasses?.length) {
        return unavailable('No previous holiday program period was found in Acuity.')
    }

    const previousPeriod = getProgramPeriod(previousClasses)
    const previousStart = DateTime.fromISO(previousClasses[0].time).setZone(REPORT_TIME_ZONE)
    const previousCutoff = previousStart.startOf('day').minus({ days: daysBeforeStart }).endOf('day')
    const previousAppointmentsByClassId = await getAppointmentsByClassId({
        acuity,
        classes: previousClasses,
        calendarId,
        showAll: true,
    })
    const previousActiveAppointmentsByClassId = getActiveAppointmentsByClassId(previousAppointmentsByClassId)
    const previousCapacityByClassId = new Map(
        previousClasses.map((klass) => [
            klass.id,
            (previousActiveAppointmentsByClassId.get(klass.id)?.length ?? 0) + klass.slotsAvailable,
        ])
    )
    const currentCapacityByClassId = new Map(currentClassResults.map((klass) => [klass.classId, klass.totalCapacity]))

    const currentPace = getBookingPaceByStudio({
        classes: currentClasses,
        appointmentsByClassId: currentAppointmentsByClassId,
        capacityByClassId: currentCapacityByClassId,
        cutoff: generatedAt,
        studios,
    })
    const previousPace = getBookingPaceByStudio({
        classes: previousClasses,
        appointmentsByClassId: previousAppointmentsByClassId,
        capacityByClassId: previousCapacityByClassId,
        cutoff: previousCutoff,
        studios,
    })
    const excludedAppointments = currentPace.excludedAppointments + previousPace.excludedAppointments
    const current = summariseBookingPace([...currentPace.byStudio.values()])
    const previous = summariseBookingPace([...previousPace.byStudio.values()])

    if (previous.totalCapacity === 0) {
        return {
            ...unavailable('The previous holiday program capacity could not be determined from Acuity.'),
            previousPeriod: { ...previousPeriod, cutoffDate: previousCutoff.toISODate()! },
            excludedAppointments,
        }
    }

    return {
        available: true,
        approximate: true,
        daysBeforeStart,
        currentPeriod,
        previousPeriod: { ...previousPeriod, cutoffDate: previousCutoff.toISODate()! },
        current,
        previous,
        percentagePointDifference: current.utilisationPercentage - previous.utilisationPercentage,
        studios: studios.map((studio) => {
            const currentStudio = currentPace.byStudio.get(studio) ?? emptyBookingPaceSummary()
            const previousStudio = previousPace.byStudio.get(studio) ?? emptyBookingPaceSummary()
            return {
                studio,
                current: currentStudio,
                previous: previousStudio,
                percentagePointDifference: currentStudio.utilisationPercentage - previousStudio.utilisationPercentage,
            }
        }),
        excludedAppointments,
    }
}

function getBookingPaceByStudio({
    classes,
    appointmentsByClassId,
    capacityByClassId,
    cutoff,
    studios,
}: {
    classes: HolidayProgramClass[]
    appointmentsByClassId: Map<number, AcuityTypes.Api.Appointment[]>
    capacityByClassId: Map<number, number>
    cutoff: DateTime
    studios: Studio[]
}) {
    let excludedAppointments = 0
    const byStudio = new Map(
        studios.map((studio) => [studio, { bookingsMade: 0, totalCapacity: 0, utilisationPercentage: 0 }])
    )

    for (const klass of classes) {
        const studio = Object.entries(AcuityConstants.StoreCalendars).find(([, id]) => id === klass.calendarID)?.[0] as
            | Studio
            | undefined
        if (!studio || !byStudio.has(studio)) continue

        const appointments = appointmentsByClassId.get(klass.id) ?? []
        const bookingsMade = appointments.filter((appointment) => {
            const createdAt = getAppointmentCreatedAt(appointment)
            if (!createdAt) {
                excludedAppointments += 1
                return false
            }
            return createdAt.toMillis() <= cutoff.toMillis()
        }).length
        const existing = byStudio.get(studio)!
        existing.bookingsMade += bookingsMade
        existing.totalCapacity += capacityByClassId.get(klass.id) ?? 0
    }

    for (const summary of byStudio.values()) {
        summary.utilisationPercentage = calculateUtilisation(summary.bookingsMade, summary.totalCapacity)
    }

    return { byStudio, excludedAppointments }
}

function getAppointmentCreatedAt(appointment: AcuityTypes.Api.Appointment) {
    const value = appointment.datetimeCreated ?? appointment.dateCreated
    if (!value) return null

    const parsers = [
        () => DateTime.fromISO(value, { zone: REPORT_TIME_ZONE }),
        () => DateTime.fromSQL(value, { zone: REPORT_TIME_ZONE }),
        () => DateTime.fromRFC2822(value, { zone: REPORT_TIME_ZONE }),
        () => DateTime.fromFormat(value, 'LLLL d, yyyy h:mma', { zone: REPORT_TIME_ZONE }),
        () => DateTime.fromFormat(value, 'LLLL d, yyyy h:mm a', { zone: REPORT_TIME_ZONE }),
    ]
    return parsers.map((parse) => parse()).find((result) => result.isValid) ?? null
}

function getProgramPeriods(classes: HolidayProgramClass[]) {
    return [...classes]
        .sort((a, b) => a.time.localeCompare(b.time))
        .reduce<HolidayProgramClass[][]>((periods, klass) => {
            const currentPeriod = periods.at(-1)
            const previousClass = currentPeriod?.at(-1)
            if (!currentPeriod || !previousClass) {
                periods.push([klass])
                return periods
            }

            const gapDays = DateTime.fromISO(klass.time)
                .startOf('day')
                .diff(DateTime.fromISO(previousClass.time).startOf('day'), 'days').days
            if (gapDays > PROGRAM_PERIOD_BREAK_DAYS) periods.push([klass])
            else currentPeriod.push(klass)
            return periods
        }, [])
}

function getProgramPeriod(classes: HolidayProgramClass[]): HolidayProgramPeriod {
    const dates = classes.map((klass) => klass.time.split('T')[0]).sort()
    return { startDate: dates[0], endDate: dates.at(-1)! }
}

function summariseBookingPace(rows: HolidayProgramBookingPaceSummary[]): HolidayProgramBookingPaceSummary {
    const bookingsMade = rows.reduce((total, row) => total + row.bookingsMade, 0)
    const totalCapacity = rows.reduce((total, row) => total + row.totalCapacity, 0)
    return {
        bookingsMade,
        totalCapacity,
        utilisationPercentage: calculateUtilisation(bookingsMade, totalCapacity),
    }
}

function emptyBookingPaceSummary(): HolidayProgramBookingPaceSummary {
    return { bookingsMade: 0, totalCapacity: 0, utilisationPercentage: 0 }
}

function summarise(rows: HolidayProgramCapacitySummary[]): HolidayProgramCapacitySummary {
    const bookedSpots = rows.reduce((total, row) => total + row.bookedSpots, 0)
    const totalCapacity = rows.reduce((total, row) => total + row.totalCapacity, 0)
    const slotsAvailable = rows.reduce((total, row) => total + row.slotsAvailable, 0)

    return {
        bookedSpots,
        totalCapacity,
        slotsAvailable,
        utilisationPercentage: calculateUtilisation(bookedSpots, totalCapacity),
    }
}

function calculateUtilisation(bookedSpots: number, totalCapacity: number) {
    if (totalCapacity === 0) return 0
    return (bookedSpots / totalCapacity) * 100
}
