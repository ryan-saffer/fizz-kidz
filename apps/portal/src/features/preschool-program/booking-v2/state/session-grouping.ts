import { DateTime } from 'luxon'

import type { LocalAcuityClass } from './cart-store'

export type SessionGroup = {
    key: string
    day: string
    time: string
    sortValue: number
    classes: LocalAcuityClass[]
    bookableClasses: LocalAcuityClass[]
    isFullTermBookable: boolean
}

/** Three weeks between classes, so one skipped week (e.g. a public holiday) stays in the same term. */
export const TERM_BOUNDARY_GAP_DAYS = 21

type BaseSessionGroup = Omit<SessionGroup, 'key' | 'classes' | 'bookableClasses' | 'isFullTermBookable'> & {
    classes: LocalAcuityClass[]
}

/** Groups Acuity classes by weekday/time and splits them into inferred school-term blocks. */
export function groupClasses(classes: LocalAcuityClass[], now = new Date()) {
    const baseGroups = new Map<string, BaseSessionGroup>()

    classes.forEach((klass) => {
        const start = DateTime.fromJSDate(klass.time, { zone: 'Australia/Melbourne' })
        const key = `${start.weekday}-${start.toFormat('HH:mm')}`
        const existing = baseGroups.get(key)
        const group = existing ?? {
            day: start.toFormat('cccc'),
            time: start.toFormat('h:mm a'),
            sortValue: start.weekday * 1440 + start.hour * 60 + start.minute,
            classes: [],
        }

        group.classes.push(klass)
        baseGroups.set(key, group)
    })

    return Array.from(baseGroups.entries())
        .flatMap(([baseKey, group]) => splitIntoTermGroups(baseKey, group, now))
        .sort((a, b) => a.sortValue - b.sortValue)
}

/**
 * Returns upcoming classes plus, when requested, past classes from inferred term blocks that are still in progress.
 */
export function filterAttendanceClassesForCurrentTerms(
    classes: LocalAcuityClass[],
    showPreviousSessions: boolean,
    now = new Date()
) {
    const today = DateTime.fromJSDate(now, { zone: 'Australia/Melbourne' }).startOf('day')
    const isUpcoming = (klass: LocalAcuityClass) =>
        DateTime.fromJSDate(klass.time, { zone: 'Australia/Melbourne' }).startOf('day') >= today

    if (!showPreviousSessions) return classes.filter(isUpcoming)

    const activeTermClassIds = new Set(
        groupClasses(classes, now)
            .filter(
                (group) =>
                    group.classes.some((klass) => !isUpcoming(klass)) &&
                    group.classes.some((klass) => isUpcoming(klass))
            )
            .flatMap((group) => group.classes.map((klass) => klass.id))
    )

    return classes.filter((klass) => isUpcoming(klass) || activeTermClassIds.has(klass.id))
}

/** Splits one weekday/time group whenever consecutive classes are at least three weeks apart. */
function splitIntoTermGroups(baseKey: string, group: BaseSessionGroup, now: Date) {
    const sortedClasses = group.classes.sort((a, b) => a.time.getTime() - b.time.getTime())
    const termGroups: SessionGroup[] = []
    let currentTerm: LocalAcuityClass[] = []

    sortedClasses.forEach((klass) => {
        const previousClass = currentTerm.at(-1)
        // Rounded so a daylight saving change (a 23 or 25 hour day) doesn't move a class across the boundary.
        const gapDays = previousClass
            ? Math.round(DateTime.fromJSDate(klass.time).diff(DateTime.fromJSDate(previousClass.time), 'days').days)
            : 0

        if (previousClass && gapDays >= TERM_BOUNDARY_GAP_DAYS) {
            termGroups.push(createTermGroup(baseKey, group, currentTerm, termGroups.length, now))
            currentTerm = []
        }

        currentTerm.push(klass)
    })

    if (currentTerm.length > 0) {
        termGroups.push(createTermGroup(baseKey, group, currentTerm, termGroups.length, now))
    }

    return termGroups
}

/** Builds display and full-term eligibility metadata for one inferred term. */
function createTermGroup(
    baseKey: string,
    group: Omit<SessionGroup, 'key' | 'classes' | 'bookableClasses' | 'isFullTermBookable'>,
    classes: LocalAcuityClass[],
    termIndex: number,
    now: Date
): SessionGroup {
    const bookableClasses = classes.filter((klass) => klass.time.getTime() > now.getTime())
    const firstClass = classes[0]

    return {
        ...group,
        key: `${baseKey}-${termIndex}-${firstClass.id}`,
        sortValue: firstClass.time.getTime(),
        classes,
        bookableClasses,
        isFullTermBookable:
            firstClass.time.getTime() > now.getTime() && classes.every((klass) => klass.slotsAvailable > 0),
    }
}
