import { TRPCError } from '@trpc/server'
import { DateTime } from 'luxon'
import { z } from 'zod'

import {
    getPartyBookingCapacity,
    PARTY_BOOKING_CAPACITY_END_DATE,
    PARTY_BOOKING_CAPACITY_START_DATE,
    STUDIOS,
} from '@fizz-kidz/core'
import type { Studio, StudioOrMaster } from '@fizz-kidz/core'

import { DatabaseClient } from '@/integrations/firebase/database.client'

const REPORT_ZONE = 'Australia/Melbourne'

const studioOrMasterSchema = z.custom<StudioOrMaster>(
    (value) => typeof value === 'string' && (value === 'master' || STUDIOS.includes(value as Studio))
)

export const generateCapacityReportInputSchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    studio: studioOrMasterSchema,
})

export type GenerateCapacityReportInput = z.infer<typeof generateCapacityReportInputSchema>

export type GenerateCapacityReportResponse = {
    startDate: string
    endDate: string
    studio: StudioOrMaster
    overall: CapacityReportSummary
    studios: CapacityReportStudioResult[]
    weeks: CapacityReportWeekResult[]
}

type CapacityReportSummary = {
    bookedSlots: number
    availableSlots: number
    utilisationPercentage: number
}

type CapacityReportStudioSummary = CapacityReportSummary & {
    studio: Studio
}

type CapacityReportStudioResult = CapacityReportStudioSummary & { weeks: CapacityReportWeekSummary[] }

type CapacityReportWeekSummary = CapacityReportSummary & { startDate: string; endDate: string }

type CapacityReportWeekResult = CapacityReportWeekSummary & { studios: CapacityReportStudioSummary[] }

const throwReportError = (message: string, errorCode: string): never => {
    throw new TRPCError({ code: 'BAD_REQUEST', message, cause: { errorCode } })
}

const summariseCapacity = (bookedSlots: number, availableSlots: number): CapacityReportSummary => ({
    bookedSlots,
    availableSlots,
    utilisationPercentage: availableSlots === 0 ? 0 : (bookedSlots / availableSlots) * 100,
})

export async function generateCapacityReport(
    input: GenerateCapacityReportInput
): Promise<GenerateCapacityReportResponse> {
    const startDate = DateTime.fromISO(input.startDate, { zone: REPORT_ZONE }).startOf('day')
    const endDate = DateTime.fromISO(input.endDate, { zone: REPORT_ZONE }).startOf('day')

    if (!startDate.isValid || !endDate.isValid) {
        throwReportError('date range is invalid', 'invalid-date')
    }

    if (startDate > endDate) {
        throwReportError('start date must come before the end date', 'invalid-range')
    }

    const capacityStartDate = DateTime.fromISO(PARTY_BOOKING_CAPACITY_START_DATE, { zone: REPORT_ZONE })
    const capacityEndDate = DateTime.fromISO(PARTY_BOOKING_CAPACITY_END_DATE, { zone: REPORT_ZONE })
    if (startDate < capacityStartDate || endDate > capacityEndDate) {
        throwReportError(
            `capacity is only available from ${PARTY_BOOKING_CAPACITY_START_DATE} to ${PARTY_BOOKING_CAPACITY_END_DATE}`,
            'capacity-unavailable'
        )
    }

    const bookings = (
        await DatabaseClient.getPartyBookingsForCapacityReport({
            startDate: startDate.toJSDate(),
            endDate: endDate.plus({ days: 1 }).toJSDate(),
            studio: input.studio,
        })
    ).filter((booking) => booking.type === 'studio')
    const studios = input.studio === 'master' ? STUDIOS : [input.studio]
    const weeks: { startDate: DateTime; endDate: DateTime }[] = []
    let weekStart = startDate

    while (weekStart <= endDate) {
        const sunday = weekStart.plus({ days: 7 - weekStart.weekday })
        const weekEnd = sunday < endDate ? sunday : endDate
        weeks.push({ startDate: weekStart, endDate: weekEnd })
        weekStart = weekEnd.plus({ days: 1 })
    }

    const getBookedSlots = (studio: Studio, periodStart: DateTime, periodEnd: DateTime) =>
        bookings.filter((booking) => {
            if (booking.location !== studio) return false
            const bookingDate = DateTime.fromJSDate(booking.dateTime.toDate(), { zone: REPORT_ZONE })
            return bookingDate >= periodStart && bookingDate < periodEnd.plus({ days: 1 })
        }).length

    const studioResults = studios.map((studio) => {
        const availableSlots = getPartyBookingCapacity(input.startDate, input.endDate)

        return {
            studio,
            ...summariseCapacity(getBookedSlots(studio, startDate, endDate), availableSlots),
            weeks: weeks.map(({ startDate: periodStart, endDate: periodEnd }) => {
                const weekStartDate = periodStart.toISODate()
                const weekEndDate = periodEnd.toISODate()
                const weekCapacity = getPartyBookingCapacity(weekStartDate, weekEndDate)

                return {
                    startDate: weekStartDate,
                    endDate: weekEndDate,
                    ...summariseCapacity(getBookedSlots(studio, periodStart, periodEnd), weekCapacity),
                }
            }),
        }
    })

    const overall = summariseCapacity(
        studioResults.reduce((total, studio) => total + studio.bookedSlots, 0),
        studioResults.reduce((total, studio) => total + studio.availableSlots, 0)
    )

    return {
        startDate: input.startDate,
        endDate: input.endDate,
        studio: input.studio,
        overall,
        studios: studioResults,
        weeks: weeks.map(({ startDate: periodStart, endDate: periodEnd }, weekIndex) => {
            const weekStudios = studioResults.map(({ studio, weeks: studioWeeks }) => ({
                studio,
                ...studioWeeks[weekIndex],
            }))

            return {
                startDate: periodStart.toISODate(),
                endDate: periodEnd.toISODate(),
                ...summariseCapacity(
                    weekStudios.reduce((total, studio) => total + studio.bookedSlots, 0),
                    weekStudios.reduce((total, studio) => total + studio.availableSlots, 0)
                ),
                studios: weekStudios.map((studio) => ({
                    studio: studio.studio,
                    bookedSlots: studio.bookedSlots,
                    availableSlots: studio.availableSlots,
                    utilisationPercentage: studio.utilisationPercentage,
                })),
            }
        }),
    }
}
