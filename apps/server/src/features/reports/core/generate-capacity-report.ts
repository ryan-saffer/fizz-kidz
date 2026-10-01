import { TRPCError } from '@trpc/server'
import { DateTime } from 'luxon'
import { z } from 'zod'

import {
    getPartyBookingCapacity,
    PARTY_BOOKING_CAPACITY_END_DATE,
    PARTY_BOOKING_CAPACITY_START_DATE,
    STUDIOS,
} from '@fizz-kidz/core'
import type { PartyBookingCapacityType, Studio, StudioOrMaster } from '@fizz-kidz/core'

import { DatabaseClient } from '@/integrations/firebase/database.client'

const REPORT_ZONE = 'Australia/Melbourne'

const studioOrMasterSchema = z.custom<StudioOrMaster>(
    (value) => typeof value === 'string' && (value === 'master' || STUDIOS.includes(value as Studio))
)

export const generateCapacityReportInputSchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    studio: studioOrMasterSchema,
    partyTypes: z.array(z.enum(['studio', 'mobile'])).min(1),
})

export type GenerateCapacityReportInput = z.infer<typeof generateCapacityReportInputSchema>

export type GenerateCapacityReportResponse = {
    startDate: string
    endDate: string
    studio: StudioOrMaster
    partyTypes: PartyBookingCapacityType[]
    overall: CapacityReportSummary
    studios: CapacityReportStudioResult[]
    weeks: CapacityReportWeekResult[]
}

type CapacitySlots = {
    bookedSlots: number
    availableSlots: number
    utilisationPercentage: number
}

type CapacityReportPartyTypeSummary = CapacitySlots & {
    type: PartyBookingCapacityType
}

// Totals across the selected party types, plus a summary for each selected type
type CapacityReportSummary = CapacitySlots & {
    byPartyType: CapacityReportPartyTypeSummary[]
}

type CapacityReportStudioSummary = CapacityReportSummary & {
    studio: Studio
}

type CapacityReportStudioResult = CapacityReportStudioSummary & {
    weeks: CapacityReportWeekSummary[]
}

type CapacityReportWeekSummary = CapacityReportSummary & {
    startDate: string
    endDate: string
}

type CapacityReportWeekResult = CapacityReportWeekSummary & {
    studios: CapacityReportStudioSummary[]
}

const throwReportError = (message: string, errorCode: string): never => {
    throw new TRPCError({ code: 'BAD_REQUEST', message, cause: { errorCode } })
}

const summariseCapacity = (bookedSlots: number, availableSlots: number): CapacitySlots => ({
    bookedSlots,
    availableSlots,
    utilisationPercentage: availableSlots === 0 ? 0 : (bookedSlots / availableSlots) * 100,
})

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

const summarisePartyTypes = (byPartyType: CapacityReportPartyTypeSummary[]): CapacityReportSummary => ({
    ...summariseCapacity(
        sum(byPartyType.map((summary) => summary.bookedSlots)),
        sum(byPartyType.map((summary) => summary.availableSlots))
    ),
    byPartyType,
})

const combineSummaries = (partyTypes: PartyBookingCapacityType[], summaries: CapacityReportSummary[]) =>
    summarisePartyTypes(
        partyTypes.map((type, index) => ({
            type,
            ...summariseCapacity(
                sum(summaries.map((summary) => summary.byPartyType[index].bookedSlots)),
                sum(summaries.map((summary) => summary.byPartyType[index].availableSlots))
            ),
        }))
    )

export async function generateCapacityReport(
    input: GenerateCapacityReportInput
): Promise<GenerateCapacityReportResponse> {
    const startDate = DateTime.fromISO(input.startDate, {
        zone: REPORT_ZONE,
    }).startOf('day')
    const endDate = DateTime.fromISO(input.endDate, {
        zone: REPORT_ZONE,
    }).startOf('day')

    if (!startDate.isValid || !endDate.isValid) {
        throwReportError('date range is invalid', 'invalid-date')
    }

    if (startDate > endDate) {
        throwReportError('start date must come before the end date', 'invalid-range')
    }

    const capacityStartDate = DateTime.fromISO(PARTY_BOOKING_CAPACITY_START_DATE, { zone: REPORT_ZONE })
    const capacityEndDate = DateTime.fromISO(PARTY_BOOKING_CAPACITY_END_DATE, {
        zone: REPORT_ZONE,
    })
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
    ).filter((booking) => input.partyTypes.includes(booking.type))
    const studios = input.studio === 'master' ? STUDIOS : [input.studio]
    const weeks: { startDate: DateTime; endDate: DateTime }[] = []
    let weekStart = startDate

    while (weekStart <= endDate) {
        const sunday = weekStart.plus({ days: 7 - weekStart.weekday })
        const weekEnd = sunday < endDate ? sunday : endDate
        weeks.push({ startDate: weekStart, endDate: weekEnd })
        weekStart = weekEnd.plus({ days: 1 })
    }

    const getBookedSlots = (
        studio: Studio,
        type: PartyBookingCapacityType,
        periodStart: DateTime,
        periodEnd: DateTime
    ) =>
        bookings.filter((booking) => {
            if (booking.location !== studio || booking.type !== type) return false
            const bookingDate = DateTime.fromJSDate(booking.dateTime.toDate(), {
                zone: REPORT_ZONE,
            })
            return bookingDate >= periodStart && bookingDate < periodEnd.plus({ days: 1 })
        }).length

    const summariseStudio = (studio: Studio, periodStart: DateTime, periodEnd: DateTime) =>
        summarisePartyTypes(
            input.partyTypes.map((type) => ({
                type,
                ...summariseCapacity(
                    getBookedSlots(studio, type, periodStart, periodEnd),
                    getPartyBookingCapacity(periodStart.toISODate(), periodEnd.toISODate(), [type])
                ),
            }))
        )

    const studioResults = studios.map((studio) => ({
        studio,
        ...summariseStudio(studio, startDate, endDate),
        weeks: weeks.map(({ startDate: periodStart, endDate: periodEnd }) => ({
            startDate: periodStart.toISODate(),
            endDate: periodEnd.toISODate(),
            ...summariseStudio(studio, periodStart, periodEnd),
        })),
    }))

    return {
        startDate: input.startDate,
        endDate: input.endDate,
        studio: input.studio,
        partyTypes: input.partyTypes,
        overall: combineSummaries(input.partyTypes, studioResults),
        studios: studioResults,
        weeks: weeks.map(({ startDate: periodStart, endDate: periodEnd }, weekIndex) => {
            const weekStudios = studioResults.map(({ studio, weeks: studioWeeks }) => ({
                studio,
                bookedSlots: studioWeeks[weekIndex].bookedSlots,
                availableSlots: studioWeeks[weekIndex].availableSlots,
                utilisationPercentage: studioWeeks[weekIndex].utilisationPercentage,
                byPartyType: studioWeeks[weekIndex].byPartyType,
            }))

            return {
                startDate: periodStart.toISODate(),
                endDate: periodEnd.toISODate(),
                ...combineSummaries(input.partyTypes, weekStudios),
                studios: weekStudios,
            }
        }),
    }
}
