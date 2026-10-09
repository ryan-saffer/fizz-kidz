import { DateTime } from 'luxon'

import type { AcuityTypes } from '@fizz-kidz/core'

export const TERM_LOOKBACK_MONTHS = 6
/** Three weeks between classes, so one skipped week (e.g. a public holiday) stays in the same term. */
const TERM_BOUNDARY_GAP_DAYS = 21

/** Finds the inferred term block containing a class using weekday/time grouping and three-week boundaries. */
export function getTermClassesForClass(klass: AcuityTypes.Api.Class, allClasses: AcuityTypes.Api.Class[]) {
    const groupKey = getClassGroupKey(klass)
    const groupClasses = allClasses
        .filter((candidate) => getClassGroupKey(candidate) === groupKey)
        .sort(
            (a, b) =>
                DateTime.fromISO(a.time, { setZone: true }).toMillis() -
                DateTime.fromISO(b.time, { setZone: true }).toMillis()
        )

    const terms: AcuityTypes.Api.Class[][] = []
    let currentTerm: AcuityTypes.Api.Class[] = []

    groupClasses.forEach((candidate) => {
        const previousClass = currentTerm.at(-1)
        // Rounded so a daylight saving change (a 23 or 25 hour day) doesn't move a class across the boundary.
        const gapDays = previousClass
            ? Math.round(
                  DateTime.fromISO(candidate.time, { setZone: true }).diff(
                      DateTime.fromISO(previousClass.time, { setZone: true }),
                      'days'
                  ).days
              )
            : 0

        if (previousClass && gapDays >= TERM_BOUNDARY_GAP_DAYS) {
            terms.push(currentTerm)
            currentTerm = []
        }

        currentTerm.push(candidate)
    })

    if (currentTerm.length > 0) terms.push(currentTerm)

    return terms.find((term) => term.some((candidate) => candidate.id === klass.id)) ?? []
}

/** Builds a stable studio, weekday, and start-time key for an Acuity class. */
function getClassGroupKey(klass: AcuityTypes.Api.Class) {
    const start = DateTime.fromISO(klass.time, { setZone: true })
    return `${klass.calendarID}-${start.weekday}-${start.toFormat('HH:mm')}`
}

/**
 * Sessions a booking can be rescheduled to: other sessions at the same studio, on any weekday or time,
 * whose own term overlaps the booked session's term.
 */
export function getSameTermClasses(classId: number, allClasses: AcuityTypes.Api.Class[]) {
    const klass = allClasses.find((candidate) => candidate.id === classId)
    if (!klass) return []
    const [termStart, termEnd] = getTermRange(klass, allClasses)

    return allClasses.filter((candidate) => {
        if (candidate.id === classId || candidate.calendarID !== klass.calendarID) return false
        const [start, end] = getTermRange(candidate, allClasses)
        return start <= termEnd && end >= termStart
    })
}

function getTermRange(klass: AcuityTypes.Api.Class, allClasses: AcuityTypes.Api.Class[]) {
    const term = getTermClassesForClass(klass, allClasses)
    return [toMillis(term[0]), toMillis(term[term.length - 1])]
}

function toMillis(klass: AcuityTypes.Api.Class) {
    return DateTime.fromISO(klass.time, { setZone: true }).toMillis()
}
