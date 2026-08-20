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
})

export type GenerateHolidayProgramCapacityReportInput = z.infer<typeof generateHolidayProgramCapacityReportInputSchema>

export type HolidayProgramCapacityReportResponse = {
    studio: StudioOrMaster
    generatedAt: string
    overall: HolidayProgramCapacitySummary
    studios: HolidayProgramCapacityStudioResult[]
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

export async function generateHolidayProgramCapacityReport(
    input: GenerateHolidayProgramCapacityReportInput
): Promise<HolidayProgramCapacityReportResponse> {
    const acuity = await AcuityClient.getInstance()
    const studios = input.studio === 'master' ? STUDIOS : [input.studio]
    const calendarIdsByStudio = new Map(
        Object.entries(AcuityConstants.StoreCalendars).map(([studio, id]) => [id, studio as Studio])
    )
    const allowedCalendarIds = new Set(studios.map((studio) => AcuityConstants.StoreCalendars[studio]))

    const classes = (await mergeAcuityWithSanity(await acuity.getClasses(appointmentTypeIds, true, Date.now())))
        .filter((klass) => allowedCalendarIds.has(klass.calendarID))
        .sort((a, b) => a.time.localeCompare(b.time))

    const appointmentsByClassId = await getAppointmentsByClassId({
        acuity,
        classes,
        calendarId: input.studio === 'master' ? undefined : AcuityConstants.StoreCalendars[input.studio],
    })

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

    return {
        studio: input.studio,
        generatedAt: new Date().toISOString(),
        overall: summarise(studioResults),
        studios: studioResults,
    }
}

async function getAppointmentsByClassId({
    acuity,
    classes,
    calendarId,
}: {
    acuity: Awaited<ReturnType<typeof AcuityClient.getInstance>>
    classes: Array<AcuityTypes.Api.Class & { title?: string }>
    calendarId?: number
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
