import { DateTime, Duration, Interval } from 'luxon'

import { ObjectKeys, assertNever, type ShiftUnderMinimumShiftLength, type Studio } from '@fizz-kidz/core'

import type { Rate } from './timesheets.types'
import type { Timesheet } from '@/integrations/sling/sling.types'

/**
 * Breaks the range down into weeks, and returns them as an array of intervals.
 * If the range is not divisible by 7, the final interval will include only the remaining days.
 *
 * @param start
 * @param end
 */
export function getWeeks(_start: DateTime, end: DateTime) {
    const output: Interval[] = []
    let start = _start
    while (start <= end) {
        if (Interval.fromDateTimes(start, end).length('days') <= 6) {
            output.push(Interval.fromDateTimes(start, end))
        } else {
            output.push(Interval.after(start, Duration.fromObject({ days: 6 })))
        }
        start = start.plus({ days: 7 })
    }
    return output
}

/**
 * Returns true if dob is more than 18 years ago (relative to today)
 */
export function isYoungerThan18(dob: DateTime) {
    return DateTime.now().diff(dob, 'years').years < 18
}

export function getShiftsUnderMinimumShiftLength({
    firstName,
    lastName,
    usersTimesheets,
    timezone,
}: {
    firstName: string
    lastName: string
    usersTimesheets: Timesheet[]
    timezone: string
}): ShiftUnderMinimumShiftLength[] {
    return usersTimesheets.flatMap((timesheet) => {
        const start = DateTime.fromISO(timesheet.dtstart, { zone: timezone })
        const end = DateTime.fromISO(timesheet.dtend, { zone: timezone })
        const position = SlingPositionMap[timesheet.position.id]
        const shiftLengthInMinutes = Math.round(end.diff(start, 'minutes').minutes)
        const minimumShiftLengthInMinutes = start.weekday === 7 ? 4 * 60 : 3 * 60

        if (shiftLengthInMinutes >= minimumShiftLengthInMinutes) {
            return []
        }

        return [
            {
                employeeName: `${firstName} ${lastName}`,
                positionName: formatSlingPositionLabel(position),
                shiftDate: start.toFormat('ccc dd/LL/yyyy'),
                workedLength: formatShiftLength(shiftLengthInMinutes),
                minimumLength: formatShiftLength(minimumShiftLengthInMinutes),
                notes: timesheet.summary.trim(),
            },
        ]
    })
}

/**
 * Returns an array of timesheet rows based on the users timesheets for that week.
 * Takes overtime into consideration.
 *
 * @param slingUser the user in sling
 * @param xeroUser the user in xero
 * @param usersTimesheets the users timesheets from sling
 * @returns an array of timesheet rows
 */
export function createTimesheetRows({
    firstName,
    lastName,
    dob,
    hasBirthdayDuringPayrun,
    isCasual,
    overtimeThreshold,
    usersTimesheets,
    rate,
    timezone,
}: {
    firstName: string
    lastName: string
    dob: DateTime
    hasBirthdayDuringPayrun: boolean
    isCasual: boolean
    overtimeThreshold: number
    usersTimesheets: Timesheet[]
    rate: Rate
    timezone: string
}): { rows: TimesheetRow[]; totalHours: number } {
    const rows: TimesheetRow[] = []

    // keep track of hours worked this week
    let totalHours = 0

    usersTimesheets.map((timesheet) => {
        const position = SlingPositionMap[timesheet.position.id]
        const location = SlingLocationsMap[timesheet.location.id]
        const start = DateTime.fromISO(timesheet.dtstart, { zone: timezone })
        const end = DateTime.fromISO(timesheet.dtend, { zone: timezone })
        const shiftLengthInHours = end.diff(start, 'hours').hours

        // calculate if this shift puts employee into overtime for the week
        const hoursUntilWeeklyOvertime = overtimeThreshold - totalHours

        // on call shifts do not contribute towards overtime
        const isOnCall = isOnCallShift(position)

        if (hoursUntilWeeklyOvertime > 0 || isOnCall) {
            // overtime not yet reached

            const overtimeHours = shiftLengthInHours - hoursUntilWeeklyOvertime
            if (overtimeHours <= 0 || isOnCall) {
                // entire shift fits before reaching overtime

                // any time above 10 hours in a single shift is overtime
                const isShiftAboveTenHours = shiftLengthInHours > 10 && !isOnCall
                const hoursAboveTen = shiftLengthInHours - 10

                // first add up to the first 10 hours
                rows.push(
                    new TimesheetRow({
                        firstName,
                        lastName,
                        dob,
                        hasBirthdayDuringPayrun,
                        date: start,
                        isCasual,
                        position,
                        location,
                        hours: isShiftAboveTenHours ? 10 : shiftLengthInHours,
                        summary: timesheet.summary,
                        rate,
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    })
                )

                // then add the remaining hours as overtime
                if (isShiftAboveTenHours) {
                    // check if the hours above 10 are more than 3 (to calculate first three vs after three hours)
                    const isMoreThanThreeHours = hoursAboveTen > 3

                    if (isMoreThanThreeHours) {
                        // first add the first three hours
                        rows.push(
                            new TimesheetRow({
                                firstName,
                                lastName,
                                dob,
                                hasBirthdayDuringPayrun,
                                date: start,
                                isCasual,
                                position,
                                location,
                                hours: 3,
                                summary: timesheet.summary,
                                rate,
                                overtime: { firstThreeHours: true, afterThreeHours: false },
                            })
                        )

                        // then the rest
                        rows.push(
                            new TimesheetRow({
                                firstName,
                                lastName,
                                dob,
                                hasBirthdayDuringPayrun,
                                date: start,
                                isCasual,
                                position,
                                location,
                                hours: hoursAboveTen - 3,
                                summary: timesheet.summary,
                                rate,
                                overtime: { firstThreeHours: false, afterThreeHours: true },
                            })
                        )
                    } else {
                        // all hours above 10 fit within first three hours
                        rows.push(
                            new TimesheetRow({
                                firstName,
                                lastName,
                                dob,
                                hasBirthdayDuringPayrun,
                                date: start,
                                isCasual,
                                position,
                                location,
                                hours: hoursAboveTen,
                                summary: timesheet.summary,
                                rate,
                                overtime: { firstThreeHours: true, afterThreeHours: false },
                            })
                        )
                    }
                }
            } else {
                // only part of the shift fits before reaching overtime.
                // add until overtime, and then add the rest as overtime
                rows.push(
                    new TimesheetRow({
                        firstName,
                        lastName,
                        dob,
                        hasBirthdayDuringPayrun,
                        isCasual,
                        date: start,
                        position,
                        location,
                        hours: hoursUntilWeeklyOvertime,
                        summary: timesheet.summary,
                        rate,
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    })
                )

                createOvertimeTimesheetRows(
                    shiftLengthInHours - hoursUntilWeeklyOvertime,
                    overtimeThreshold,
                    overtimeThreshold,
                    firstName,
                    lastName,
                    dob,
                    hasBirthdayDuringPayrun,
                    isCasual,
                    start,
                    position,
                    location,
                    rate,
                    timesheet.summary
                ).map((row) => rows.push(row))
            }
        } else {
            // already in overtime
            createOvertimeTimesheetRows(
                shiftLengthInHours,
                totalHours,
                overtimeThreshold,
                firstName,
                lastName,
                dob,
                hasBirthdayDuringPayrun,
                isCasual,
                start,
                position,
                location,
                rate,
                timesheet.summary
            ).map((row) => rows.push(row))
        }

        if (!isOnCall) {
            totalHours += shiftLengthInHours
        }
    })

    return { rows, totalHours }
}

function formatShiftLength(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (minutes === 0) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
    }

    if (hours === 0) {
        return `${minutes} minutes`
    }

    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} minutes`
}

function formatSlingPositionLabel(position: SlingPosition | undefined) {
    if (!position) {
        return 'Unknown'
    }

    return position
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

function createOvertimeTimesheetRows(
    hours: number,
    totalHours: number,
    overtimeThreshold: number,
    firstName: string,
    lastName: string,
    dob: DateTime,
    hasBirthdayDuringPayrun: boolean,
    isCasual: boolean,
    date: DateTime,
    position: SlingPosition,
    location: SlingLocation,
    rate: Rate,
    summary: string
) {
    const output: TimesheetRow[] = []

    // calculate if the hours puts employee into after three hours of overtime
    const hoursUntilAfterThreeHours = overtimeThreshold + 3 - totalHours

    if (hoursUntilAfterThreeHours > 0) {
        // after three hours not yet reached
        const afterThreeHours = hours - hoursUntilAfterThreeHours
        if (afterThreeHours <= 0) {
            // entire time fits before reaching after three hours
            output.push(
                new TimesheetRow({
                    firstName,
                    lastName,
                    dob,
                    hasBirthdayDuringPayrun,
                    isCasual,
                    date,
                    position,
                    location,
                    hours,
                    summary,
                    rate,
                    overtime: { firstThreeHours: true, afterThreeHours: false },
                })
            )
        } else {
            // only part of the shift fits before reaching after three hours.
            // add until after three hours, and then add the rest as after three hours
            output.push(
                new TimesheetRow({
                    firstName,
                    lastName,
                    dob,
                    hasBirthdayDuringPayrun,
                    isCasual,
                    date,
                    position,
                    location,
                    hours: hoursUntilAfterThreeHours,
                    summary,
                    rate,
                    overtime: { firstThreeHours: true, afterThreeHours: false },
                })
            )
            output.push(
                new TimesheetRow({
                    firstName,
                    lastName,
                    dob,
                    hasBirthdayDuringPayrun,
                    isCasual,
                    date,
                    position,
                    location,
                    hours: afterThreeHours,
                    summary,
                    rate,
                    overtime: { firstThreeHours: false, afterThreeHours: true },
                })
            )
        }
    } else {
        // already after three hours
        output.push(
            new TimesheetRow({
                firstName,
                lastName,
                dob,
                hasBirthdayDuringPayrun,
                isCasual,
                date,
                position,
                location,
                hours,
                summary,
                rate,
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
        )
    }

    return output
}

type Overtime =
    | { firstThreeHours: false; afterThreeHours: false }
    | { firstThreeHours: true; afterThreeHours: false }
    | { firstThreeHours: false; afterThreeHours: true }

export class TimesheetRow {
    firstName: string
    lastname: string
    dob: DateTime
    hasBirthdayDuringPayrun: boolean
    payItem: PayItem
    date: DateTime
    isCasual: boolean
    hours: number
    overtime: Overtime
    rate: Rate
    summary: string
    position: SlingPosition
    activity: XeroTrackingActivity

    constructor({
        firstName,
        lastName,
        dob,
        hasBirthdayDuringPayrun,
        date,
        position,
        location,
        isCasual,
        hours,
        overtime,
        rate,
        summary,
    }: {
        firstName: string
        lastName: string
        dob: DateTime
        hasBirthdayDuringPayrun: boolean
        date: DateTime
        position: SlingPosition
        location: SlingLocation
        isCasual: boolean
        hours: number
        overtime: Overtime
        rate: Rate
        summary: string
    }) {
        this.firstName = firstName
        this.lastname = lastName
        this.dob = dob
        this.hasBirthdayDuringPayrun = hasBirthdayDuringPayrun
        this.date = date
        this.isCasual = isCasual
        this.hours = hours
        this.overtime = overtime
        this.rate = rate
        this.summary = summary
        this.position = position

        // calculate pay item
        this.payItem = this.getPayItem(position, location)

        // map to activity
        this.activity = SlingPositionToActivityMap[position]
    }

    /**
     * On Call shifts and Called In shifts do not map to overtime hours, but still count towards the weekly 38 hours of overtime.
     */
    private getPayItem(position: SlingPosition, location: SlingLocation): PayItem {
        // on call does not count towards overtime so check that first
        if (isOnCallShift(position)) return this._getOnCallPayItem(location)
        // called in pays more than overtime, so even if a called in shift is in overtime, it should still be a called in pay item
        if (isCalledInShift(position)) return this._getCalledInPayItem(location)
        // then get overtime if applicable
        if (this.overtime.firstThreeHours) return this._getOvertimeFirstThreeHours(location)
        if (this.overtime.afterThreeHours) return this._getOvertimeAfterThreeHours(location)

        // and finally just ordinary pay items
        return this._getOrdinaryPayItem(location)
    }

    private _isMonSat() {
        // Sunday is 7
        return this.date.weekday !== 7
    }

    private _isYoungerThan18() {
        return isYoungerThan18(this.dob)
    }

    // determine if the employees rate, when working mon-sat (1.25x) is above $18.00
    private _isRateAbove18() {
        if (this.rate === 'not required') return false
        return this.rate * 1.25 >= 18
    }

    private _isCOGSShift() {
        switch (this.position) {
            case SlingPosition.MISCELLANEOUS:
            case SlingPosition.SUNDAY_MISCELLANEOUS:
            case SlingPosition.TRAINING:
            case SlingPosition.SUNDAY_TRAINING:
            case SlingPosition.PIC:
            case SlingPosition.SUNDAY_PIC:
            case SlingPosition.SUPERVISOR_PARTY:
            case SlingPosition.SUNDAY_SUPERVISOR_PARTY:
            case SlingPosition.SUPERVISOR_MOBILE_PARTY:
            case SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY:
            case SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM:
            case SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM:
            case SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS:
            case SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS:
            case SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM:
            case SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM:
            case SlingPosition.SUPERVISOR_INCURSIONS:
            case SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS:
            case SlingPosition.SUPERVISOR_PLAY_LAB:
            case SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB:
                return false
            case SlingPosition.PARTY_FACILITATOR:
            case SlingPosition.SUNDAY_PARTY_FACILITATOR:
            case SlingPosition.ON_CALL_PARTY_FACILITATOR:
            case SlingPosition.CALLED_IN_PARTY_FACILITATOR:
            case SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR:
            case SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR:
            case SlingPosition.MOBILE_PARTY_FACILITATOR:
            case SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR:
            case SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR:
            case SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR:
            case SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR:
            case SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR:
            case SlingPosition.HOLIDAY_PROGRAM_FACILITATOR:
            case SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR:
            case SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
            case SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
            case SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
            case SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
            case SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR:
            case SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR:
            case SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
            case SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
            case SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
            case SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
            case SlingPosition.PLAY_LAB_FACILITATOR:
            case SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR:
            case SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR:
            case SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR:
            case SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR:
            case SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR:
            case SlingPosition.EVENTS_AND_ACTIVATIONS:
            case SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS:
            case SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS:
            case SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS:
            case SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS:
            case SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS:
            case SlingPosition.INCURSIONS:
            case SlingPosition.SUNDAY_INCURSIONS:
            case SlingPosition.ON_CALL_INCURSIONS:
            case SlingPosition.CALLED_IN_INCURSIONS:
            case SlingPosition.SUNDAY_ON_CALL_INCURSIONS:
            case SlingPosition.SUNDAY_CALLED_IN_INCURSIONS:
                return true
            default: {
                assertNever(this.position)
                throw new Error(`Unhandled position while determining COGS shift: '${this.position}'`)
            }
        }
    }

    private _getOrdinaryPayItem(location: SlingLocation): OrdinaryPayItem {
        if (this.isCasual) {
            // CASUAL EMPLOYEES
            if (this._isMonSat()) {
                if (this._isYoungerThan18() && !this._isRateAbove18()) {
                    switch (location) {
                        case 'balwyn':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR 16&17yo COH - Mon to Sat - Balwyn'
                                : this._isCOGSShift()
                                  ? 'CGS 16&17yo COH - Mon to Sat - Balwyn'
                                  : 'NON-CGS 16&17yo COH - Mon to Sat - Balwyn'
                        case 'cheltenham':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR 16&17yo COH - Mon to Sat - Cheltenham'
                                : this._isCOGSShift()
                                  ? 'CGS 16&17yo COH - Mon to Sat - Cheltenham'
                                  : 'NON-CGS 16&17yo COH - Mon to Sat - Cheltenham'
                        case 'essendon':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR 16&17yo COH - Mon to Sat - Essendon'
                                : this._isCOGSShift()
                                  ? 'CGS 16&17yo COH - Mon to Sat - Essendon'
                                  : 'NON-CGS 16&17yo COH - Mon to Sat - Essendon'
                        case 'geelong':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR 16&17yo COH - Mon to Sat - Geelong'
                                : this._isCOGSShift()
                                  ? 'CGS 16&17yo COH - Mon to Sat - Geelong'
                                  : 'NON-CGS 16&17yo COH - Mon to Sat - Geelong'
                        case 'kingsville':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR 16&17yo COH - Mon to Sat - Kingsville'
                                : this._isCOGSShift()
                                  ? 'CGS 16&17yo COH - Mon to Sat - Kingsville'
                                  : 'NON-CGS 16&17yo COH - Mon to Sat - Kingsville'
                        case 'malvern':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR 16&17yo COH - Mon to Sat - Malvern'
                                : this._isCOGSShift()
                                  ? 'CGS 16&17yo COH - Mon to Sat - Malvern'
                                  : 'NON-CGS 16&17yo COH - Mon to Sat - Malvern'
                        case 'werribee':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR 16&17yo COH - Mon to Sat - Werribee'
                                : this._isCOGSShift()
                                  ? 'CGS 16&17yo COH - Mon to Sat - Werribee'
                                  : 'NON-CGS 16&17yo COH - Mon to Sat - Werribee'
                        case 'head-office':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR 16&17yo COH - Mon to Sat - Head Office'
                                : this._isCOGSShift()
                                  ? 'CGS 16&17yo COH - Mon to Sat - Head Office'
                                  : 'NON-CGS 16&17yo COH - Mon to Sat - Head Office'
                        default: {
                            assertNever(location)
                            throw new Error(`Unrecognised location processing payroll: ${location}`)
                        }
                    }
                } else {
                    switch (location) {
                        case 'balwyn':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR COH - Mon to Sat - Balwyn'
                                : this._isCOGSShift()
                                  ? 'CGS COH - Mon to Sat - Balwyn'
                                  : 'NON-CGS COH - Mon to Sat - Balwyn'
                        case 'cheltenham':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR COH - Mon to Sat - Cheltenham'
                                : this._isCOGSShift()
                                  ? 'CGS COH - Mon to Sat - Cheltenham'
                                  : 'NON-CGS COH - Mon to Sat - Cheltenham'
                        case 'essendon':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR COH - Mon to Sat - Essendon'
                                : this._isCOGSShift()
                                  ? 'CGS COH - Mon to Sat - Essendon'
                                  : 'NON-CGS COH - Mon to Sat - Essendon'
                        case 'geelong':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR COH - Mon to Sat - Geelong'
                                : this._isCOGSShift()
                                  ? 'CGS COH - Mon to Sat - Geelong'
                                  : 'NON-CGS COH - Mon to Sat - Geelong'
                        case 'kingsville':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR COH - Mon to Sat - Kingsville'
                                : this._isCOGSShift()
                                  ? 'CGS COH - Mon to Sat - Kingsville'
                                  : 'NON-CGS COH - Mon to Sat - Kingsville'
                        case 'malvern':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR COH - Mon to Sat - Malvern'
                                : this._isCOGSShift()
                                  ? 'CGS COH - Mon to Sat - Malvern'
                                  : 'NON-CGS COH - Mon to Sat - Malvern'
                        case 'werribee':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR COH - Mon to Sat - Werribee'
                                : this._isCOGSShift()
                                  ? 'CGS COH - Mon to Sat - Werribee'
                                  : 'NON-CGS COH - Mon to Sat - Werribee'
                        case 'head-office':
                            return isSupervisorShift(this.position)
                                ? 'SUPERVISOR COH - Mon to Sat - Head Office'
                                : this._isCOGSShift()
                                  ? 'CGS COH - Mon to Sat - Head Office'
                                  : 'NON-CGS COH - Mon to Sat - Head Office'
                        default: {
                            assertNever(location)
                            throw new Error(`Unrecognised location processing payroll: ${location}`)
                        }
                    }
                }
            } else {
                switch (location) {
                    case 'balwyn':
                        return isSupervisorShift(this.position)
                            ? 'SUPERVISOR COH - Sunday - Balwyn'
                            : this._isCOGSShift()
                              ? 'CGS COH - Sunday - Balwyn'
                              : 'NON-CGS COH - Sunday - Balwyn'
                    case 'cheltenham':
                        return isSupervisorShift(this.position)
                            ? 'SUPERVISOR COH - Sunday - Cheltenham'
                            : this._isCOGSShift()
                              ? 'CGS COH - Sunday - Cheltenham'
                              : 'NON-CGS COH - Sunday - Cheltenham'
                    case 'essendon':
                        return isSupervisorShift(this.position)
                            ? 'SUPERVISOR COH - Sunday - Essendon'
                            : this._isCOGSShift()
                              ? 'CGS COH - Sunday - Essendon'
                              : 'NON-CGS COH - Sunday - Essendon'
                    case 'geelong':
                        return isSupervisorShift(this.position)
                            ? 'SUPERVISOR COH - Sunday - Geelong'
                            : this._isCOGSShift()
                              ? 'CGS COH - Sunday - Geelong'
                              : 'NON-CGS COH - Sunday - Geelong'
                    case 'kingsville':
                        return isSupervisorShift(this.position)
                            ? 'SUPERVISOR COH - Sunday - Kingsville'
                            : this._isCOGSShift()
                              ? 'CGS COH - Sunday - Kingsville'
                              : 'NON-CGS COH - Sunday - Kingsville'
                    case 'malvern':
                        return isSupervisorShift(this.position)
                            ? 'SUPERVISOR COH - Sunday - Malvern'
                            : this._isCOGSShift()
                              ? 'CGS COH - Sunday - Malvern'
                              : 'NON-CGS COH - Sunday - Malvern'
                    case 'werribee':
                        return isSupervisorShift(this.position)
                            ? 'SUPERVISOR COH - Sunday - Werribee'
                            : this._isCOGSShift()
                              ? 'CGS COH - Sunday - Werribee'
                              : 'NON-CGS COH - Sunday - Werribee'
                    case 'head-office':
                        return isSupervisorShift(this.position)
                            ? 'SUPERVISOR COH - Sunday - Head Office'
                            : this._isCOGSShift()
                              ? 'CGS COH - Sunday - Head Office'
                              : 'NON-CGS COH - Sunday - Head Office'
                    default: {
                        assertNever(location)
                        throw new Error(`Unrecognised location processing payroll: ${location}`)
                    }
                }
            }
        } else {
            // PT/FT EMPLOYEES
            if (this._isMonSat()) {
                switch (location) {
                    case 'balwyn':
                        return 'PT/FT Ordinary Hours - Mon to Sat - Balwyn'
                    case 'cheltenham':
                        return 'PT/FT Ordinary Hours - Mon to Sat - Chelt'
                    case 'essendon':
                        return 'PT/FT Ordinary Hours - Mon to Sat - Essendon'
                    case 'geelong':
                        return 'PT/FT Ordinary Hours - Mon to Sat - Geelong'
                    case 'kingsville':
                        return 'PT/FT Ordinary Hours - Mon to Sat - Kingsville'
                    case 'malvern':
                        return 'PT/FT Ordinary Hours - Mon to Sat - Malvern'
                    case 'werribee':
                        return 'PT/FT Ordinary Hours - Mon to Sat - Werribee'
                    case 'head-office':
                        return 'PT/FT Ordinary Hours - Mon to Sat - Head Office'
                    default: {
                        assertNever(location)
                        throw new Error(`Unrecognised location processing payroll: ${location}`)
                    }
                }
            } else {
                switch (location) {
                    case 'balwyn':
                        return 'PT/FT Ordinary Hours - Sunday - Balwyn'
                    case 'cheltenham':
                        return 'PT/FT Ordinary Hours - Sunday - Chelt'
                    case 'essendon':
                        return 'PT/FT Ordinary Hours - Sunday - Essendon'
                    case 'geelong':
                        return 'PT/FT Ordinary Hours - Sunday - Geelong'
                    case 'kingsville':
                        return 'PT/FT Ordinary Hours - Sunday - Kingsville'
                    case 'malvern':
                        return 'PT/FT Ordinary Hours - Sunday - Malvern'
                    case 'werribee':
                        return 'PT/FT Ordinary Hours - Sunday - Werribee'
                    case 'head-office':
                        return 'PT/FT Ordinary Hours - Sunday - Head Office'
                    default: {
                        assertNever(location)
                        throw new Error(`Unrecognised location processing payroll: ${location}`)
                    }
                }
            }
        }
    }

    private _getOnCallPayItem(location: SlingLocation): OnCallPayItem {
        // all 'on calls' are COGS
        if (this._isMonSat()) {
            if (this._isYoungerThan18() && !this._isRateAbove18()) {
                switch (location) {
                    case 'balwyn':
                        return 'On call - 16&17yo Csl Or Hs - Mon to Sat - Balw'
                    case 'cheltenham':
                        return 'On call - 16&17yo Csl Or Hs - Mon to Sat - Chelt'
                    case 'essendon':
                        return 'On call - 16&17yo Csl Or Hs - Mon to Sat - Essen'
                    case 'geelong':
                        return 'On call - 16&17yo Csl Or Hs - Mon to Sat - Geelong'
                    case 'kingsville':
                        return 'On call - 16&17yo Csl Or Hs - Mon to Sat - Kings'
                    case 'malvern':
                        return 'On call - 16&17yo Csl Or Hs - Mon to Sat - Malvern'
                    case 'werribee':
                        return 'On call - 16&17yo Csl Or Hs - Mon to Sat - Werribee'
                    case 'head-office':
                        return 'On call - 16&17yo Csl Or Hs - Mon to Sat - HO'
                    default: {
                        assertNever(location)
                        throw new Error(`Unrecognised location processing payroll: ${location}`)
                    }
                }
            } else {
                switch (location) {
                    case 'balwyn':
                        return 'ON CALL - Cas Ord Hrs - Mon to Sat - Balwyn'
                    case 'cheltenham':
                        return 'ON CALL - Cas Ord Hrs - Mon to Sat - Chelt'
                    case 'essendon':
                        return 'ON CALL - Cas Ord Hrs - Mon to Sat - Essen'
                    case 'geelong':
                        return 'ON CALL - Cas Ord Hrs - Mon to Sat - Geelong'
                    case 'kingsville':
                        return 'ON CALL - Cas Ord Hrs - Mon to Sat - Kingsville'
                    case 'malvern':
                        return 'ON CALL - Cas Ord Hrs - Mon to Sat - Malv'
                    case 'werribee':
                        return 'ON CALL - Cas Ord Hrs - Mon to Sat - Werribee'
                    case 'head-office':
                        return 'ON CALL - Cas Ord Hrs - Mon to Sat - Head Office'
                    default: {
                        assertNever(location)
                        throw new Error(`Unrecognised location processing payroll: ${location}`)
                    }
                }
            }
        } else {
            switch (location) {
                case 'balwyn':
                    return 'ON CALL - Cas Ord Hrs - Sunday - Balwyn'
                case 'cheltenham':
                    return 'ON CALL - Cas Ord Hrs - Sunday - Chelt'
                case 'essendon':
                    return 'ON CALL - Cas Ord Hrs - Sunday - Essend'
                case 'geelong':
                    return 'ON CALL - Cas Ord Hrs - Sunday - Geelong'
                case 'kingsville':
                    return 'ON CALL - Cas Ord Hrs - Sunday - Kingsville'
                case 'malvern':
                    return 'ON CALL - Cas Ord Hrs - Sunday - Malvern'
                case 'werribee':
                    return 'ON CALL - Cas Ord Hrs - Sunday - Werribee'
                case 'head-office':
                    return 'ON CALL - Cas Ord Hrs - Sunday - Head Office'
                default: {
                    assertNever(location)
                    throw new Error(`Unrecognised location processing payroll: ${location}`)
                }
            }
        }
    }

    private _getCalledInPayItem(location: SlingLocation): CalledInPayItem {
        // all called in are COGS
        if (this._isMonSat()) {
            if (this._isYoungerThan18() && !this._isRateAbove18()) {
                switch (location) {
                    case 'balwyn':
                        return 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Balw'
                    case 'cheltenham':
                        return 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Chelt'
                    case 'essendon':
                        return 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Essen'
                    case 'geelong':
                        return 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Geel'
                    case 'kingsville':
                        return 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Kings'
                    case 'malvern':
                        return 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Malv'
                    case 'werribee':
                        return 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Werribee'
                    case 'head-office':
                        return 'CALLEDIN - 16&17 COH - Mon to Sat - HO'
                    default: {
                        assertNever(location)
                        throw new Error(`Unrecognised location processing payroll: ${location}`)
                    }
                }
            } else {
                switch (location) {
                    case 'balwyn':
                        return 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Balwyn'
                    case 'cheltenham':
                        return 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Chelt'
                    case 'essendon':
                        return 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Essen'
                    case 'geelong':
                        return 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Geelong'
                    case 'kingsville':
                        return 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Kingsville'
                    case 'malvern':
                        return 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Malvern'
                    case 'werribee':
                        return 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Werribee'
                    case 'head-office':
                        return 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Head Office'
                    default: {
                        assertNever(location)
                        throw new Error(`Unrecognised location processing payroll: ${location}`)
                    }
                }
            }
        } else {
            switch (location) {
                case 'balwyn':
                    return 'CALLEDIN - Cas Ord Hrs - Sun - Balwyn'
                case 'cheltenham':
                    return 'CALLEDIN - Cas Ord Hrs - Sun - Chelt'
                case 'essendon':
                    return 'CALLEDIN - Cas Ord Hrs - Sun - Essend'
                case 'geelong':
                    return 'CALLEDIN - Cas Ord Hrs - Sun - Geelong'
                case 'kingsville':
                    return 'CALLEDIN - Cas Ord Hrs - Sun - Kingsville'
                case 'malvern':
                    return 'CALLEDIN - Cas Ord Hrs - Sun - Malvern'
                case 'werribee':
                    return 'CALLEDIN - Cas Ord Hrs - Sun - Werribee'
                case 'head-office':
                    return 'CALLEDIN - Cas Ord Hrs - Sun - Head Office'
                default: {
                    assertNever(location)
                    throw new Error(`Unrecognised location processing payroll: ${location}`)
                }
            }
        }
    }

    private _getOvertimeFirstThreeHours(location: SlingLocation): OvertimeFirstThreeHours {
        if (this._isMonSat()) {
            switch (location) {
                case 'balwyn':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Balwyn'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn'
                          : 'NON-CGS OT - First 3 Hrs - Mon to Sat - Balwyn'
                case 'cheltenham':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Chelt'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Mon to Sat - Cheltenham'
                          : 'NON-CGS OT - First 3 Hrs - Mon to Sat - Cheltenham'
                case 'essendon':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Essend'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Mon to Sat - Essendon'
                          : 'NON-CGS OT - First 3 Hrs - Mon to Sat - Essendon'
                case 'geelong':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Geelong'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Mon to Sat - Geelong'
                          : 'NON-CGS OT - First 3 Hrs - Mon to Sat - Geelong'
                case 'kingsville':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Kings'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Mon to Sat - Kingsville'
                          : 'NON-CGS OT - First 3 Hrs - Mon to Sat - Kingsville'
                case 'malvern':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Malvern'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Mon to Sat - Malvern'
                          : 'NON-CGS OT - First 3 Hrs - Mon to Sat - Malvern'
                case 'werribee':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Werribee'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Mon to Sat - Werribee'
                          : 'NON-CGS OT - First 3 Hrs - Mon to Sat - Werribee'
                case 'head-office':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - HO'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Mon to Sat - Head Office'
                          : 'NON-CGS OT - First 3 Hrs - Mon to Sat - HO'
                default: {
                    assertNever(location)
                    throw new Error(`Unrecognised location processing payroll: ${location}`)
                }
            }
        } else {
            switch (location) {
                case 'balwyn':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Sunday - Balwyn'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Sunday - Balwyn'
                          : 'NON-CGS OT - First 3 Hrs - Sunday - Balwyn'
                case 'cheltenham':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Sunday - Cheltenham'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Sunday - Cheltenham'
                          : 'NON-CGS OT - First 3 Hrs - Sunday - Cheltenham'
                case 'essendon':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Sunday - Essendon'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Sunday - Essendon'
                          : 'NON-CGS OT - First 3 Hrs - Sunday - Essendon'
                case 'geelong':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Sunday - Geelong'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Sunday - Geelong'
                          : 'NON-CGS OT - First 3 Hrs - Sunday - Geelong'
                case 'kingsville':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Sunday - Kingsville'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Sunday - Kingsville'
                          : 'NON-CGS OT - First 3 Hrs - Sunday - Kingsville'
                case 'malvern':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Sunday - Malvern'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Sunday - Malvern'
                          : 'NON-CGS OT - First 3 Hrs - Sunday - Malvern'
                case 'werribee':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Sunday - Werribee'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Sunday - Werribee'
                          : 'NON-CGS OT - First 3 Hrs - Sunday - Werribee'
                case 'head-office':
                    return isSupervisorShift(this.position)
                        ? 'SUPERVISOR OT - First 3 Hrs - Sunday - Head Office'
                        : this._isCOGSShift()
                          ? 'CGS OT - First 3 Hrs - Sunday - Head Office'
                          : 'NON-CGS OT - First 3 Hrs - Sunday - Head Office'
                default: {
                    assertNever(location)
                    throw new Error(`Unrecognised location processing payroll: ${location}`)
                }
            }
        }
    }

    private _getOvertimeAfterThreeHours(location: SlingLocation): OvertimeAfterThreeHours {
        switch (location) {
            case 'balwyn':
                return isSupervisorShift(this.position)
                    ? 'SUPERVISOR OT - After 3 Hrs - Balwyn'
                    : this._isCOGSShift()
                      ? 'CGS OT - After 3 Hrs - Balwyn'
                      : 'NON-CGS OT - After 3 Hrs - Balwyn'
            case 'cheltenham':
                return isSupervisorShift(this.position)
                    ? 'SUPERVISOR OT - After 3 Hrs - Cheltenham'
                    : this._isCOGSShift()
                      ? 'CGS OT - After 3 Hrs - Cheltenham'
                      : 'NON-CGS OT - After 3 Hrs - Cheltenham'
            case 'essendon':
                return isSupervisorShift(this.position)
                    ? 'SUPERVISOR OT - After 3 Hrs - Essendon'
                    : this._isCOGSShift()
                      ? 'CGS OT - After 3 Hrs - Essendon'
                      : 'NON-CGS OT - After 3 Hrs - Essendon'
            case 'geelong':
                return isSupervisorShift(this.position)
                    ? 'SUPERVISOR OT - After 3 Hrs - Geelong'
                    : this._isCOGSShift()
                      ? 'CGS OT - After 3 Hrs - Geelong'
                      : 'NON-CGS OT - After 3 Hrs - Geelong'
            case 'kingsville':
                return isSupervisorShift(this.position)
                    ? 'SUPERVISOR OT - After 3 Hrs - Kingsville'
                    : this._isCOGSShift()
                      ? 'CGS OT - After 3 Hrs - Kingsville'
                      : 'NON-CGS OT - After 3 Hrs - Kingsville'
            case 'malvern':
                return isSupervisorShift(this.position)
                    ? 'SUPERVISOR OT - After 3 Hrs - Malvern'
                    : this._isCOGSShift()
                      ? 'CGS OT - After 3 Hrs - Malvern'
                      : 'NON-CGS OT - After 3 Hrs - Malvern'
            case 'werribee':
                return isSupervisorShift(this.position)
                    ? 'SUPERVISOR OT - After 3 Hrs - Werribee'
                    : this._isCOGSShift()
                      ? 'CGS OT - After 3 Hrs - Werribee'
                      : 'NON-CGS OT - After 3 Hrs - Werribee'
            case 'head-office':
                return isSupervisorShift(this.position)
                    ? 'SUPERVISOR OT - After 3 Hrs - Head Office'
                    : this._isCOGSShift()
                      ? 'CGS OT - After 3 Hrs - Head Office'
                      : 'NON-CGS OT - After 3 Hrs - Head Office'
        }
    }
}

/** Maximum eligible laundry allowance days per Mon-Sun week. */
export const LAUNDRY_MAX_DAYS_PER_WEEK = 5

/**
 * A row representing the laundry allowance for a single eligible day.
 *
 * Shaped to be CSV-writable alongside `TimesheetRow` (shares
 * `firstName` / `lastname` / `payItem` / `activity` / `date` / `hours` /
 * `summary` fields).
 */
export class LaundryAllowanceRow {
    firstName: string
    lastname: string
    date: DateTime
    hours: number
    payItem: LaundryAllowancePayItem
    activity: XeroTrackingActivity
    summary: string

    constructor({
        firstName,
        lastName,
        date,
        hours,
        location,
        activity,
        summary,
    }: {
        firstName: string
        lastName: string
        date: DateTime
        hours: number
        location: SlingLocation
        activity: XeroTrackingActivity
        summary: string
    }) {
        this.firstName = firstName
        this.lastname = lastName
        this.date = date
        this.hours = hours
        this.payItem = getLaundryAllowancePayItem(location)
        this.activity = activity
        this.summary = summary
    }
}

/**
 * Returns laundry allowance rows for the given week.
 *
 * An "eligible day" is any calendar day (in the user's timezone) on which the
 * employee worked at least one `isLaundryEligibleShift` shift.
 *
 * Up to `LAUNDRY_MAX_DAYS_PER_WEEK` rows are emitted at 1 unit each. Each row
 * inherits the location + activity of the earliest-starting eligible shift on
 * its associated day. Further eligible days do not generate rows because the
 * weekly day cap has been reached. Xero controls the value of each unit.
 */
export function createLaundryAllowanceRows({
    firstName,
    lastName,
    usersTimesheets,
    timezone,
}: {
    firstName: string
    lastName: string
    usersTimesheets: Timesheet[]
    timezone: string
}): LaundryAllowanceRow[] {
    // Group eligible shifts by calendar day, keeping the earliest shift per day
    // to drive location + activity for the resulting row.
    const eligibleShiftsByDay = new Map<
        string,
        { date: DateTime; firstShiftStart: DateTime; location: SlingLocation; activity: XeroTrackingActivity }
    >()

    for (const timesheet of usersTimesheets) {
        const position = SlingPositionMap[timesheet.position.id]
        if (!position || !isLaundryEligibleShift(position)) continue

        const location = SlingLocationsMap[timesheet.location.id]
        if (!location) continue

        const start = DateTime.fromISO(timesheet.dtstart, { zone: timezone })
        const dayKey = start.toISODate() // YYYY-MM-DD in the user's timezone
        if (!dayKey) continue

        const existing = eligibleShiftsByDay.get(dayKey)
        if (!existing || start < existing.firstShiftStart) {
            eligibleShiftsByDay.set(dayKey, {
                date: start.startOf('day'),
                firstShiftStart: start,
                location,
                activity: SlingPositionToActivityMap[position],
            })
        }
    }

    // Sort days chronologically so the weekly cap deterministically keeps the
    // earliest eligible days when capping.
    const sortedDays = [...eligibleShiftsByDay.values()].sort(
        (a, b) => a.firstShiftStart.toMillis() - b.firstShiftStart.toMillis()
    )

    return sortedDays.slice(0, LAUNDRY_MAX_DAYS_PER_WEEK).map(
        ({ date, location, activity }) =>
            new LaundryAllowanceRow({
                firstName,
                lastName,
                date,
                hours: 1,
                location,
                activity,
                summary: 'Laundry allowance',
            })
    )
}

/**
 * Tells you if a birthday falls between two dates.
 *
 * @param dob the date of birth
 * @param start start of the range
 * @param end end of the range
 * @returns true if users birthday falls within the range, false otherwise
 */
export function hasBirthdayDuring(dob: DateTime, start: DateTime, end: DateTime) {
    let year = start.year

    while (year <= end.year) {
        const nextBirthday = DateTime.fromObject({
            year,
            month: dob.month,
            day: dob.day,
        })

        if (start <= nextBirthday && nextBirthday <= end) {
            return true
        }

        year++
    }

    return false
}

/**
 * Identical logic to the get pay item functions, but returns the rate rather than the pay item.
 * Only used to set wage in Sling corressponding to the shift type so we can see the estimated wage of a shift.
 * Not used to actually calculate any wages (that is done in Xero based on the pay item).
 */
export function getPositionRate({ positionId, rate, dob }: { positionId: number; rate: number; dob: DateTime }) {
    const f = (val: number) => val.toFixed(4).toString()

    const isRateAbove18 = rate * 1.25 >= 18

    const position = SlingPositionMap[positionId]

    if (isOnCallShift(position)) {
        if (!isSundayShift(position)) {
            // mon - sat
            if (isYoungerThan18(dob) && !isRateAbove18) {
                return '1.8'
            } else {
                return f(rate * 0.125)
            }
        } else {
            // sunday
            return f(rate * 0.175)
        }
    }

    if (isCalledInShift(position)) {
        if (!isSundayShift(position)) {
            // mon - sat
            if (isYoungerThan18(dob) && !isRateAbove18) {
                return '27'
            } else {
                return f(rate * 1.875)
            }
        } else {
            // sunday
            return f(rate * 2.625)
        }
    }

    // ordinary shift
    if (!isSundayShift(position)) {
        // mon - sat
        if (isYoungerThan18(dob) && !isRateAbove18) {
            return '18'
        } else {
            return f(rate * 1.25)
        }
    } else {
        // sunday
        return f(rate * 1.75)
    }
}

/**
 * Returns true if working a shift in this position makes the employee eligible
 * for the daily laundry allowance.
 *
 * Eligibility = the position requires wearing a Fizz Kidz uniform.
 *
 * Source of truth for the rules is the historical backpay analysis in the
 * `wages-backpay-reports` repo (`input data/positions.csv`).
 *
 * Excluded shift types (and why):
 *   - Supervisor:  does not run programs / not in costume (e.g. doing the shop run).
 *   - On Call:     not actually working unless called in.
 *   - PIC:         on-call equivalent.
 *   - Training:    no uniform required.
 *   - Miscellaneous: catch-all (e.g. covering customer service); no uniform.
 *   - Superhero:   already paid above award so allowance is absorbed (we don't
 *     model superhero as a separate position - it's a manual Xero pay item).
 *
 * NOTE: CALLED_IN_* positions are still treated as eligible here because the
 *       facilitator still works the shift in uniform. These positions are
 *       slated for removal from the codebase entirely (they no longer exist in
 *       Sling) but until that cleanup happens we keep them laundry-eligible.
 */
export function isLaundryEligibleShift(position: SlingPosition) {
    switch (position) {
        // Mon - Sat facilitator shifts
        case SlingPosition.PARTY_FACILITATOR:
        case SlingPosition.MOBILE_PARTY_FACILITATOR:
        case SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.PLAY_LAB_FACILITATOR:
        case SlingPosition.EVENTS_AND_ACTIVATIONS:
        case SlingPosition.INCURSIONS:
        case SlingPosition.SUNDAY_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR:
        case SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_INCURSIONS:
        case SlingPosition.CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.CALLED_IN_INCURSIONS:
        case SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_CALLED_IN_INCURSIONS:
            return true
        case SlingPosition.ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.ON_CALL_INCURSIONS:
        case SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_ON_CALL_INCURSIONS:
        case SlingPosition.PIC:
        case SlingPosition.SUNDAY_PIC:
        case SlingPosition.SUPERVISOR_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_PARTY:
        case SlingPosition.SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUPERVISOR_INCURSIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS:
        case SlingPosition.SUPERVISOR_PLAY_LAB:
        case SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB:
        case SlingPosition.TRAINING:
        case SlingPosition.SUNDAY_TRAINING:
        case SlingPosition.MISCELLANEOUS:
        case SlingPosition.SUNDAY_MISCELLANEOUS:
            return false
        default: {
            assertNever(position)
            throw new Error(`Unhandled position while determining isLaundryEligibleShift(): '${position}'`)
        }
    }
}

export function isSupervisorShift(position: SlingPosition) {
    switch (position) {
        case SlingPosition.SUPERVISOR_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_PARTY:
        case SlingPosition.SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUPERVISOR_INCURSIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS:
        case SlingPosition.SUPERVISOR_PLAY_LAB:
        case SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB:
            return true
        case SlingPosition.PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR:
        case SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR:
        case SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.INCURSIONS:
        case SlingPosition.SUNDAY_INCURSIONS:
        case SlingPosition.ON_CALL_INCURSIONS:
        case SlingPosition.CALLED_IN_INCURSIONS:
        case SlingPosition.SUNDAY_ON_CALL_INCURSIONS:
        case SlingPosition.SUNDAY_CALLED_IN_INCURSIONS:
        case SlingPosition.MISCELLANEOUS:
        case SlingPosition.SUNDAY_MISCELLANEOUS:
        case SlingPosition.TRAINING:
        case SlingPosition.SUNDAY_TRAINING:
        case SlingPosition.PIC:
        case SlingPosition.SUNDAY_PIC:
            return false
        default: {
            assertNever(position)
            throw new Error(`Unhandled position while determining isSupervisorShift(): '${position}'`)
        }
    }
}

export function isOnCallShift(position: SlingPosition) {
    switch (position) {
        case SlingPosition.ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.ON_CALL_INCURSIONS:
        case SlingPosition.SUNDAY_ON_CALL_INCURSIONS:
        case SlingPosition.PIC:
        case SlingPosition.SUNDAY_PIC:
            return true
        case SlingPosition.MISCELLANEOUS:
        case SlingPosition.SUNDAY_MISCELLANEOUS:
        case SlingPosition.TRAINING:
        case SlingPosition.SUNDAY_TRAINING:
        case SlingPosition.PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR:
        case SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR:
        case SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.INCURSIONS:
        case SlingPosition.SUNDAY_INCURSIONS:
        case SlingPosition.CALLED_IN_INCURSIONS:
        case SlingPosition.SUNDAY_CALLED_IN_INCURSIONS:
        case SlingPosition.SUPERVISOR_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_PARTY:
        case SlingPosition.SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUPERVISOR_INCURSIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS:
        case SlingPosition.SUPERVISOR_PLAY_LAB:
        case SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB:
            return false
        default: {
            assertNever(position)
            throw new Error(`Unrecognised position when asking isOnCallShift: '${position}'`)
        }
    }
}

export function isCalledInShift(position: SlingPosition) {
    switch (position) {
        case SlingPosition.CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.CALLED_IN_INCURSIONS:
        case SlingPosition.SUNDAY_CALLED_IN_INCURSIONS:
            return true
        case SlingPosition.MISCELLANEOUS:
        case SlingPosition.SUNDAY_MISCELLANEOUS:
        case SlingPosition.TRAINING:
        case SlingPosition.SUNDAY_TRAINING:
        case SlingPosition.PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR:
        case SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR:
        case SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.INCURSIONS:
        case SlingPosition.SUNDAY_INCURSIONS:
        case SlingPosition.ON_CALL_INCURSIONS:
        case SlingPosition.SUNDAY_ON_CALL_INCURSIONS:
        case SlingPosition.PIC:
        case SlingPosition.SUNDAY_PIC:
        case SlingPosition.SUPERVISOR_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_PARTY:
        case SlingPosition.SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUPERVISOR_INCURSIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS:
        case SlingPosition.SUPERVISOR_PLAY_LAB:
        case SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB:
            return false
        default: {
            assertNever(position)
            throw new Error(`Unrecognised position when asking isCalledInShift: '${position}'`)
        }
    }
}

export function isSundayShift(position: SlingPosition) {
    switch (position) {
        case SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_CALLED_IN_INCURSIONS:
        case SlingPosition.SUNDAY_MISCELLANEOUS:
        case SlingPosition.SUNDAY_TRAINING:
        case SlingPosition.SUNDAY_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_INCURSIONS:
        case SlingPosition.SUNDAY_ON_CALL_INCURSIONS:
        case SlingPosition.SUNDAY_PIC:
        case SlingPosition.SUNDAY_SUPERVISOR_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS:
        case SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB:
            return true
        case SlingPosition.CALLED_IN_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR:
        case SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.CALLED_IN_INCURSIONS:
        case SlingPosition.MISCELLANEOUS:
        case SlingPosition.TRAINING:
        case SlingPosition.PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_PARTY_FACILITATOR:
        case SlingPosition.MOBILE_PARTY_FACILITATOR:
        case SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR:
        case SlingPosition.HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR:
        case SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR:
        case SlingPosition.PLAY_LAB_FACILITATOR:
        case SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR:
        case SlingPosition.EVENTS_AND_ACTIVATIONS:
        case SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.INCURSIONS:
        case SlingPosition.ON_CALL_INCURSIONS:
        case SlingPosition.PIC:
        case SlingPosition.SUPERVISOR_PARTY:
        case SlingPosition.SUPERVISOR_MOBILE_PARTY:
        case SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM:
        case SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS:
        case SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM:
        case SlingPosition.SUPERVISOR_INCURSIONS:
        case SlingPosition.SUPERVISOR_PLAY_LAB:
            return false
        default: {
            assertNever(position)
            throw new Error(`Unrecognised position when asking isCalledInShift: '${position}'`)
        }
    }
}

export type SlingLocation = Studio | 'head-office'

export enum SlingPosition {
    PARTY_FACILITATOR = 'PARTY_FACILITATOR',
    MOBILE_PARTY_FACILITATOR = 'MOBILE_PARTY_FACILITATOR',
    AFTER_SCHOOL_PROGRAM_FACILITATOR = 'AFTER_SCHOOL_PROGRAM_FACILITATOR',
    HOLIDAY_PROGRAM_FACILITATOR = 'HOLIDAY_PROGRAM_FACILITATOR',
    PLAY_LAB_FACILITATOR = 'PLAY_LAB_FACILITATOR',
    EVENTS_AND_ACTIVATIONS = 'EVENTS_AND_ACTIVATIONS',
    INCURSIONS = 'INCURSIONS',
    SUPERVISOR_PARTY = 'SUPERVISOR_PARTY',
    SUPERVISOR_MOBILE_PARTY = 'SUPERVISOR_MOBILE_PARTY',
    SUPERVISOR_AFTER_SCHOOL_PROGRAM = 'SUPERVISOR_AFTER_SCHOOL_PROGRAM',
    SUPERVISOR_HOLIDAY_PROGRAM = 'SUPERVISOR_HOLIDAY_PROGRAM',
    SUPERVISOR_PLAY_LAB = 'SUPERVISOR_PLAY_LAB',
    SUPERVISOR_EVENTS_AND_ACTIVATIONS = 'SUPERVISOR_EVENTS_AND_ACTIVATIONS',
    SUPERVISOR_INCURSIONS = 'SUPERVISOR_INCURSIONS',
    ON_CALL_PARTY_FACILITATOR = 'ON_CALL_PARTY_FACILITATOR',
    ON_CALL_MOBILE_PARTY_FACILITATOR = 'ON_CALL_MOBILE_PARTY_FACILITATOR',
    ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR = 'ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR',
    ON_CALL_HOLIDAY_PROGRAM_FACILITATOR = 'ON_CALL_HOLIDAY_PROGRAM_FACILITATOR',
    ON_CALL_PLAY_LAB_FACILITATOR = 'ON_CALL_PLAY_LAB_FACILITATOR',
    ON_CALL_EVENTS_AND_ACTIVATIONS = 'ON_CALL_EVENTS_AND_ACTIVATIONS',
    ON_CALL_INCURSIONS = 'ON_CALL_INCURSIONS',
    CALLED_IN_PARTY_FACILITATOR = 'CALLED_IN_PARTY_FACILITATOR',
    CALLED_IN_MOBILE_PARTY_FACILITATOR = 'CALLED_IN_MOBILE_PARTY_FACILITATOR',
    CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR = 'CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR',
    CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR = 'CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR',
    CALLED_IN_PLAY_LAB_FACILITATOR = 'CALLED_IN_PLAY_LAB_FACILITATOR',
    CALLED_IN_EVENTS_AND_ACTIVATIONS = 'CALLED_IN_EVENTS_AND_ACTIVATIONS',
    CALLED_IN_INCURSIONS = 'CALLED_IN_INCURSIONS',
    SUNDAY_PARTY_FACILITATOR = 'SUNDAY_PARTY_FACILITATOR',
    SUNDAY_MOBILE_PARTY_FACILITATOR = 'SUNDAY_MOBILE_PARTY_FACILITATOR',
    SUNDAY_AFTER_SCHOOL_FACILITATOR = 'SUNDAY_AFTER_SCHOOL_FACILITATOR',
    SUNDAY_HOLIDAY_PROGRAM_FACILITATOR = 'SUNDAY_HOLIDAY_PROGRAM_FACILITATOR',
    SUNDAY_PLAY_LAB_FACILITATOR = 'SUNDAY_PLAY_LAB_FACILITATOR',
    SUNDAY_EVENTS_AND_ACTIVATIONS = 'SUNDAY_EVENTS_AND_ACTIVATIONS',
    SUNDAY_INCURSIONS = 'SUNDAY_INCURSIONS',
    SUNDAY_SUPERVISOR_PARTY = 'SUNDAY_SUPERVISOR_PARTY',
    SUNDAY_SUPERVISOR_MOBILE_PARTY = 'SUNDAY_SUPERVISOR_MOBILE_PARTY',
    SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM = 'SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM',
    SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM = 'SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM',
    SUNDAY_SUPERVISOR_PLAY_LAB = 'SUNDAY_SUPERVISOR_PLAY_LAB',
    SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS = 'SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS',
    SUNDAY_SUPERVISOR_INCURSIONS = 'SUNDAY_SUPERVISOR_INCURSIONS',
    SUNDAY_ON_CALL_PARTY_FACILITATOR = 'SUNDAY_ON_CALL_PARTY_FACILITATOR',
    SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR = 'SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR',
    SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR = 'SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR',
    SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR = 'SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR',
    SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR = 'SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR',
    SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS = 'SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS',
    SUNDAY_ON_CALL_INCURSIONS = 'SUNDAY_ON_CALL_INCURSIONS',
    SUNDAY_CALLED_IN_PARTY_FACILITATOR = 'SUNDAY_CALLED_IN_PARTY_FACILITATOR',
    SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR = 'SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR',
    SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR = 'SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR',
    SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR = 'SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR',
    SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR = 'SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR',
    SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS = 'SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS',
    SUNDAY_CALLED_IN_INCURSIONS = 'SUNDAY_CALLED_IN_INCURSIONS',

    TRAINING = 'TRAINING', // NOT COGS
    SUNDAY_TRAINING = 'SUNDAY_TRAINING',
    PIC = 'PIC', // Person In Charge - Same as on call shift
    SUNDAY_PIC = 'SUNDAY_PIC',
    MISCELLANEOUS = 'MISCELLANEOUS', // Catch all - Non COGS (Eg. Covering customer service)
    SUNDAY_MISCELLANEOUS = 'SUNDAY_MISCELLANEOUS',
}

export const SlingPositionToId: Record<SlingPosition, number> = {
    [SlingPosition.PARTY_FACILITATOR]: 4809533,
    [SlingPosition.MOBILE_PARTY_FACILITATOR]: 25261610,
    [SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR]: 5206290,
    [SlingPosition.HOLIDAY_PROGRAM_FACILITATOR]: 5557194,
    [SlingPosition.PLAY_LAB_FACILITATOR]: 23638376,
    [SlingPosition.EVENTS_AND_ACTIVATIONS]: 22914259,
    [SlingPosition.INCURSIONS]: 25288121,
    [SlingPosition.ON_CALL_PARTY_FACILITATOR]: 25262039,
    [SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR]: 25262063,
    [SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR]: 25262076,
    [SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR]: 25262047,
    [SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR]: 25262094,
    [SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS]: 25262054,
    [SlingPosition.ON_CALL_INCURSIONS]: 25288122,
    [SlingPosition.CALLED_IN_PARTY_FACILITATOR]: 13464921,
    [SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR]: 25261978,
    [SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR]: 25261965,
    [SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR]: 13464944,
    [SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR]: 23638377,
    [SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS]: 25261991,
    [SlingPosition.CALLED_IN_INCURSIONS]: 25288124,
    [SlingPosition.SUNDAY_PARTY_FACILITATOR]: 25262618,
    [SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR]: 25262619,
    [SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR]: 25262621,
    [SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR]: 25262620,
    [SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR]: 25262624,
    [SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS]: 25262622,
    [SlingPosition.SUNDAY_INCURSIONS]: 25288126,
    [SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR]: 25262141,
    [SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR]: 25262128,
    [SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR]: 25262142,
    [SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR]: 25262136,
    [SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR]: 25262140,
    [SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS]: 25262132,
    [SlingPosition.SUNDAY_ON_CALL_INCURSIONS]: 25288131,
    [SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR]: 25262145,
    [SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR]: 25262146,
    [SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR]: 25262149,
    [SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR]: 25262147,
    [SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR]: 25262148,
    [SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS]: 25262144,
    [SlingPosition.SUNDAY_CALLED_IN_INCURSIONS]: 25288128,
    [SlingPosition.TRAINING]: 22914258,
    [SlingPosition.MISCELLANEOUS]: 6161155,
    [SlingPosition.SUNDAY_TRAINING]: 25267532,
    [SlingPosition.SUNDAY_MISCELLANEOUS]: 25267526,
    [SlingPosition.PIC]: 25333970,
    [SlingPosition.SUNDAY_PIC]: 25333971,
    [SlingPosition.SUPERVISOR_PARTY]: 25545172,
    [SlingPosition.SUNDAY_SUPERVISOR_PARTY]: 25545174,
    [SlingPosition.SUPERVISOR_MOBILE_PARTY]: 25545179,
    [SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY]: 25545180,
    [SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM]: 25545181,
    [SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM]: 25545182,
    [SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS]: 25545184,
    [SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS]: 25545185,
    [SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM]: 25545186,
    [SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM]: 25545188,
    [SlingPosition.SUPERVISOR_INCURSIONS]: 25545192,
    [SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS]: 25545204,
    [SlingPosition.SUPERVISOR_PLAY_LAB]: 25545205,
    [SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB]: 25545207,
}

export const SlingPositionMap: Record<string, SlingPosition> = Object.fromEntries(
    ObjectKeys(SlingPositionToId).map((key) => [SlingPositionToId[key], key])
)

export const SlingLocationToId: Record<SlingLocation, number> = {
    balwyn: 4809521,
    cheltenham: 11315826,
    essendon: 4895739,
    geelong: 30494188,
    kingsville: 22982854,
    malvern: 4809537,
    werribee: 30898317,
    'head-office': 5557282,
}

export const SlingLocationsMap: Record<string, SlingLocation> = Object.fromEntries(
    ObjectKeys(SlingLocationToId).map((key) => [SlingLocationToId[key], key])
)

type XeroTrackingActivity =
    | 'Events & Activations'
    | 'After School Programs'
    | 'Holiday Programs'
    | 'Incursions'
    | 'Mobile Parties'
    | 'No Activity'
    | 'Parties'
    | 'Play Lab'
    | 'Products'
    | 'Science Programs in-store'
    | 'Training'

const SlingPositionToActivityMap: Record<SlingPosition, XeroTrackingActivity> = {
    [SlingPosition.PARTY_FACILITATOR]: 'Parties',
    [SlingPosition.MOBILE_PARTY_FACILITATOR]: 'Mobile Parties',
    [SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR]: 'After School Programs',
    [SlingPosition.HOLIDAY_PROGRAM_FACILITATOR]: 'Holiday Programs',
    [SlingPosition.PLAY_LAB_FACILITATOR]: 'Play Lab',
    [SlingPosition.EVENTS_AND_ACTIVATIONS]: 'Events & Activations',
    [SlingPosition.INCURSIONS]: 'Incursions',
    [SlingPosition.ON_CALL_PARTY_FACILITATOR]: 'Parties',
    [SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR]: 'Mobile Parties',
    [SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR]: 'After School Programs',
    [SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR]: 'Holiday Programs',
    [SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR]: 'Play Lab',
    [SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS]: 'Events & Activations',
    [SlingPosition.ON_CALL_INCURSIONS]: 'Incursions',
    [SlingPosition.CALLED_IN_PARTY_FACILITATOR]: 'Parties',
    [SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR]: 'Mobile Parties',
    [SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR]: 'After School Programs',
    [SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR]: 'Holiday Programs',
    [SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR]: 'Play Lab',
    [SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS]: 'Events & Activations',
    [SlingPosition.CALLED_IN_INCURSIONS]: 'Incursions',
    [SlingPosition.SUNDAY_PARTY_FACILITATOR]: 'Parties',
    [SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR]: 'Mobile Parties',
    [SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR]: 'After School Programs',
    [SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR]: 'Holiday Programs',
    [SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR]: 'Play Lab',
    [SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS]: 'Events & Activations',
    [SlingPosition.SUNDAY_INCURSIONS]: 'Incursions',
    [SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR]: 'Parties',
    [SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR]: 'Mobile Parties',
    [SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR]: 'After School Programs',
    [SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR]: 'Holiday Programs',
    [SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR]: 'Play Lab',
    [SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS]: 'Events & Activations',
    [SlingPosition.SUNDAY_ON_CALL_INCURSIONS]: 'Incursions',
    [SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR]: 'Parties',
    [SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR]: 'Mobile Parties',
    [SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR]: 'After School Programs',
    [SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR]: 'Holiday Programs',
    [SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR]: 'Play Lab',
    [SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS]: 'Events & Activations',
    [SlingPosition.SUNDAY_CALLED_IN_INCURSIONS]: 'Incursions',
    [SlingPosition.TRAINING]: 'Training',
    [SlingPosition.SUNDAY_TRAINING]: 'Training',
    [SlingPosition.MISCELLANEOUS]: 'No Activity',
    [SlingPosition.SUNDAY_MISCELLANEOUS]: 'No Activity',
    [SlingPosition.PIC]: 'No Activity',
    [SlingPosition.SUNDAY_PIC]: 'No Activity',
    [SlingPosition.SUPERVISOR_PARTY]: 'Parties',
    [SlingPosition.SUNDAY_SUPERVISOR_PARTY]: 'Parties',
    [SlingPosition.SUPERVISOR_MOBILE_PARTY]: 'Mobile Parties',
    [SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY]: 'Mobile Parties',
    [SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM]: 'After School Programs',
    [SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM]: 'After School Programs',
    [SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS]: 'Events & Activations',
    [SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS]: 'Events & Activations',
    [SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM]: 'Holiday Programs',
    [SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM]: 'Holiday Programs',
    [SlingPosition.SUPERVISOR_INCURSIONS]: 'Incursions',
    [SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS]: 'Incursions',
    [SlingPosition.SUPERVISOR_PLAY_LAB]: 'Play Lab',
    [SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB]: 'Play Lab',
}

const LaundryAllowancePayItemMap: Record<SlingLocation, LaundryAllowancePayItem> = {
    balwyn: 'Laundry Allowance - Balwyn',
    cheltenham: 'Laundry Allowance - Cheltenham',
    essendon: 'Laundry Allowance - Essendon',
    geelong: 'Laundry Allowance - Geelong',
    kingsville: 'Laundry Allowance - Kingsville',
    malvern: 'Laundry Allowance - Malvern',
    werribee: 'Laundry Allowance - Werribee',
    'head-office': 'Laundry Allowance - Head Office',
}

export function getLaundryAllowancePayItem(location: SlingLocation): LaundryAllowancePayItem {
    return LaundryAllowancePayItemMap[location]
}

export const NON_CASUAL_EMPLOYEE_GROUP_ID = 25291777

type COGSCasualOrdinaryMonSat =
    | 'CGS COH - Mon to Sat - Balwyn'
    | 'CGS COH - Mon to Sat - Cheltenham'
    | 'CGS COH - Mon to Sat - Essendon'
    | 'CGS COH - Mon to Sat - Geelong'
    | 'CGS COH - Mon to Sat - Kingsville'
    | 'CGS COH - Mon to Sat - Malvern'
    | 'CGS COH - Mon to Sat - Werribee'
    | 'CGS COH - Mon to Sat - Head Office'

type NonCOGSCasualOrdinaryMonSat =
    | 'NON-CGS COH - Mon to Sat - Balwyn'
    | 'NON-CGS COH - Mon to Sat - Cheltenham'
    | 'NON-CGS COH - Mon to Sat - Essendon'
    | 'NON-CGS COH - Mon to Sat - Geelong'
    | 'NON-CGS COH - Mon to Sat - Kingsville'
    | 'NON-CGS COH - Mon to Sat - Malvern'
    | 'NON-CGS COH - Mon to Sat - Werribee'
    | 'NON-CGS COH - Mon to Sat - Head Office'

type SupervisorCasualOrdinaryMonSat =
    | 'SUPERVISOR COH - Mon to Sat - Balwyn'
    | 'SUPERVISOR COH - Mon to Sat - Cheltenham'
    | 'SUPERVISOR COH - Mon to Sat - Essendon'
    | 'SUPERVISOR COH - Mon to Sat - Geelong'
    | 'SUPERVISOR COH - Mon to Sat - Kingsville'
    | 'SUPERVISOR COH - Mon to Sat - Malvern'
    | 'SUPERVISOR COH - Mon to Sat - Werribee'
    | 'SUPERVISOR COH - Mon to Sat - Head Office'

type COGSCasualOrdinarySunday =
    | 'CGS COH - Sunday - Balwyn'
    | 'CGS COH - Sunday - Cheltenham'
    | 'CGS COH - Sunday - Essendon'
    | 'CGS COH - Sunday - Geelong'
    | 'CGS COH - Sunday - Kingsville'
    | 'CGS COH - Sunday - Malvern'
    | 'CGS COH - Sunday - Werribee'
    | 'CGS COH - Sunday - Head Office'

type NonCOGSCasualOrdinarySunday =
    | 'NON-CGS COH - Sunday - Balwyn'
    | 'NON-CGS COH - Sunday - Cheltenham'
    | 'NON-CGS COH - Sunday - Essendon'
    | 'NON-CGS COH - Sunday - Geelong'
    | 'NON-CGS COH - Sunday - Kingsville'
    | 'NON-CGS COH - Sunday - Malvern'
    | 'NON-CGS COH - Sunday - Werribee'
    | 'NON-CGS COH - Sunday - Head Office'

type SupervisorCasualOrdinarySunday =
    | 'SUPERVISOR COH - Sunday - Balwyn'
    | 'SUPERVISOR COH - Sunday - Cheltenham'
    | 'SUPERVISOR COH - Sunday - Essendon'
    | 'SUPERVISOR COH - Sunday - Geelong'
    | 'SUPERVISOR COH - Sunday - Kingsville'
    | 'SUPERVISOR COH - Sunday - Malvern'
    | 'SUPERVISOR COH - Sunday - Werribee'
    | 'SUPERVISOR COH - Sunday - Head Office'

type PTFTOrdinaryMonSat =
    | 'PT/FT Ordinary Hours - Mon to Sat - Balwyn'
    | 'PT/FT Ordinary Hours - Mon to Sat - Chelt'
    | 'PT/FT Ordinary Hours - Mon to Sat - Essendon'
    | 'PT/FT Ordinary Hours - Mon to Sat - Geelong'
    | 'PT/FT Ordinary Hours - Mon to Sat - Kingsville'
    | 'PT/FT Ordinary Hours - Mon to Sat - Malvern'
    | 'PT/FT Ordinary Hours - Mon to Sat - Werribee'
    | 'PT/FT Ordinary Hours - Mon to Sat - Head Office'

type PTFTOrdinaryHoursSunday =
    | 'PT/FT Ordinary Hours - Sunday - Balwyn'
    | 'PT/FT Ordinary Hours - Sunday - Chelt'
    | 'PT/FT Ordinary Hours - Sunday - Essendon'
    | 'PT/FT Ordinary Hours - Sunday - Geelong'
    | 'PT/FT Ordinary Hours - Sunday - Kingsville'
    | 'PT/FT Ordinary Hours - Sunday - Malvern'
    | 'PT/FT Ordinary Hours - Sunday - Werribee'
    | 'PT/FT Ordinary Hours - Sunday - Head Office'

type OnCallCasualOrdinaryMonSat =
    | 'ON CALL - Cas Ord Hrs - Mon to Sat - Balwyn'
    | 'ON CALL - Cas Ord Hrs - Mon to Sat - Chelt'
    | 'ON CALL - Cas Ord Hrs - Mon to Sat - Essen'
    | 'ON CALL - Cas Ord Hrs - Mon to Sat - Geelong'
    | 'ON CALL - Cas Ord Hrs - Mon to Sat - Kingsville'
    | 'ON CALL - Cas Ord Hrs - Mon to Sat - Malv'
    | 'ON CALL - Cas Ord Hrs - Mon to Sat - Werribee'
    | 'ON CALL - Cas Ord Hrs - Mon to Sat - Head Office'

type OnCallCasualOrdinarySunday =
    | 'ON CALL - Cas Ord Hrs - Sunday - Balwyn'
    | 'ON CALL - Cas Ord Hrs - Sunday - Chelt'
    | 'ON CALL - Cas Ord Hrs - Sunday - Essend'
    | 'ON CALL - Cas Ord Hrs - Sunday - Geelong'
    | 'ON CALL - Cas Ord Hrs - Sunday - Kingsville'
    | 'ON CALL - Cas Ord Hrs - Sunday - Malvern'
    | 'ON CALL - Cas Ord Hrs - Sunday - Werribee'
    | 'ON CALL - Cas Ord Hrs - Sunday - Head Office'

type CalledInCasualOrdinaryMonSat =
    | 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Balwyn'
    | 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Chelt'
    | 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Essen'
    | 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Geelong'
    | 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Kingsville'
    | 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Malvern'
    | 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Werribee'
    | 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Head Office'

type CalledInCasualOrdinarySunday =
    | 'CALLEDIN - Cas Ord Hrs - Sun - Balwyn'
    | 'CALLEDIN - Cas Ord Hrs - Sun - Chelt'
    | 'CALLEDIN - Cas Ord Hrs - Sun - Essend'
    | 'CALLEDIN - Cas Ord Hrs - Sun - Geelong'
    | 'CALLEDIN - Cas Ord Hrs - Sun - Kingsville'
    | 'CALLEDIN - Cas Ord Hrs - Sun - Malvern'
    | 'CALLEDIN - Cas Ord Hrs - Sun - Werribee'
    | 'CALLEDIN - Cas Ord Hrs - Sun - Head Office'

type COGSUnder18CasualOrdinaryMonSat =
    | 'CGS 16&17yo COH - Mon to Sat - Balwyn'
    | 'CGS 16&17yo COH - Mon to Sat - Cheltenham'
    | 'CGS 16&17yo COH - Mon to Sat - Essendon'
    | 'CGS 16&17yo COH - Mon to Sat - Geelong'
    | 'CGS 16&17yo COH - Mon to Sat - Kingsville'
    | 'CGS 16&17yo COH - Mon to Sat - Malvern'
    | 'CGS 16&17yo COH - Mon to Sat - Werribee'
    | 'CGS 16&17yo COH - Mon to Sat - Head Office'

type NonCOGSUnder18CasualOrdinaryMonSat =
    | 'NON-CGS 16&17yo COH - Mon to Sat - Balwyn'
    | 'NON-CGS 16&17yo COH - Mon to Sat - Cheltenham'
    | 'NON-CGS 16&17yo COH - Mon to Sat - Essendon'
    | 'NON-CGS 16&17yo COH - Mon to Sat - Geelong'
    | 'NON-CGS 16&17yo COH - Mon to Sat - Kingsville'
    | 'NON-CGS 16&17yo COH - Mon to Sat - Malvern'
    | 'NON-CGS 16&17yo COH - Mon to Sat - Werribee'
    | 'NON-CGS 16&17yo COH - Mon to Sat - Head Office'

type SupervisorUnder18CasualOrdinaryMonSat =
    | 'SUPERVISOR 16&17yo COH - Mon to Sat - Balwyn'
    | 'SUPERVISOR 16&17yo COH - Mon to Sat - Cheltenham'
    | 'SUPERVISOR 16&17yo COH - Mon to Sat - Essendon'
    | 'SUPERVISOR 16&17yo COH - Mon to Sat - Geelong'
    | 'SUPERVISOR 16&17yo COH - Mon to Sat - Kingsville'
    | 'SUPERVISOR 16&17yo COH - Mon to Sat - Malvern'
    | 'SUPERVISOR 16&17yo COH - Mon to Sat - Werribee'
    | 'SUPERVISOR 16&17yo COH - Mon to Sat - Head Office'

type Under18OnCallCasualOrdinaryMonSat =
    | 'On call - 16&17yo Csl Or Hs - Mon to Sat - Balw'
    | 'On call - 16&17yo Csl Or Hs - Mon to Sat - Chelt'
    | 'On call - 16&17yo Csl Or Hs - Mon to Sat - Essen'
    | 'On call - 16&17yo Csl Or Hs - Mon to Sat - Geelong'
    | 'On call - 16&17yo Csl Or Hs - Mon to Sat - Kings'
    | 'On call - 16&17yo Csl Or Hs - Mon to Sat - Malvern'
    | 'On call - 16&17yo Csl Or Hs - Mon to Sat - Werribee'
    | 'On call - 16&17yo Csl Or Hs - Mon to Sat - HO'

type Under18CalledInOrdinaryMonSat =
    | 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Balw'
    | 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Chelt'
    | 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Essen'
    | 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Geel'
    | 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Kings'
    | 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Malv'
    | 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Werribee'
    | 'CALLEDIN - 16&17 COH - Mon to Sat - HO'

type COGSOvertimeFirstThreeHoursMonSat =
    | 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn'
    | 'CGS OT - First 3 Hrs - Mon to Sat - Cheltenham'
    | 'CGS OT - First 3 Hrs - Mon to Sat - Essendon'
    | 'CGS OT - First 3 Hrs - Mon to Sat - Geelong'
    | 'CGS OT - First 3 Hrs - Mon to Sat - Kingsville'
    | 'CGS OT - First 3 Hrs - Mon to Sat - Malvern'
    | 'CGS OT - First 3 Hrs - Mon to Sat - Werribee'
    | 'CGS OT - First 3 Hrs - Mon to Sat - Head Office'

type NonCOGSOvertimeFirstThreeHoursMonSat =
    | 'NON-CGS OT - First 3 Hrs - Mon to Sat - Balwyn'
    | 'NON-CGS OT - First 3 Hrs - Mon to Sat - Cheltenham'
    | 'NON-CGS OT - First 3 Hrs - Mon to Sat - Essendon'
    | 'NON-CGS OT - First 3 Hrs - Mon to Sat - Geelong'
    | 'NON-CGS OT - First 3 Hrs - Mon to Sat - Kingsville'
    | 'NON-CGS OT - First 3 Hrs - Mon to Sat - Malvern'
    | 'NON-CGS OT - First 3 Hrs - Mon to Sat - Werribee'
    | 'NON-CGS OT - First 3 Hrs - Mon to Sat - HO'

type SupervisorOvertimeFirstThreeHoursMonSat =
    | 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Balwyn'
    | 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Chelt'
    | 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Essend'
    | 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Geelong'
    | 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Kings'
    | 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Malvern'
    | 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Werribee'
    | 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - HO'

type COGSOvertimeFirstThreeHoursSunday =
    | 'CGS OT - First 3 Hrs - Sunday - Balwyn'
    | 'CGS OT - First 3 Hrs - Sunday - Cheltenham'
    | 'CGS OT - First 3 Hrs - Sunday - Essendon'
    | 'CGS OT - First 3 Hrs - Sunday - Geelong'
    | 'CGS OT - First 3 Hrs - Sunday - Kingsville'
    | 'CGS OT - First 3 Hrs - Sunday - Malvern'
    | 'CGS OT - First 3 Hrs - Sunday - Werribee'
    | 'CGS OT - First 3 Hrs - Sunday - Head Office'

type NonCOGSOvertimeFirstThreeHoursSunday =
    | 'NON-CGS OT - First 3 Hrs - Sunday - Balwyn'
    | 'NON-CGS OT - First 3 Hrs - Sunday - Cheltenham'
    | 'NON-CGS OT - First 3 Hrs - Sunday - Essendon'
    | 'NON-CGS OT - First 3 Hrs - Sunday - Geelong'
    | 'NON-CGS OT - First 3 Hrs - Sunday - Kingsville'
    | 'NON-CGS OT - First 3 Hrs - Sunday - Malvern'
    | 'NON-CGS OT - First 3 Hrs - Sunday - Werribee'
    | 'NON-CGS OT - First 3 Hrs - Sunday - Head Office'

type SupervisorOvertimeFirstThreeHoursSunday =
    | 'SUPERVISOR OT - First 3 Hrs - Sunday - Balwyn'
    | 'SUPERVISOR OT - First 3 Hrs - Sunday - Cheltenham'
    | 'SUPERVISOR OT - First 3 Hrs - Sunday - Essendon'
    | 'SUPERVISOR OT - First 3 Hrs - Sunday - Geelong'
    | 'SUPERVISOR OT - First 3 Hrs - Sunday - Kingsville'
    | 'SUPERVISOR OT - First 3 Hrs - Sunday - Malvern'
    | 'SUPERVISOR OT - First 3 Hrs - Sunday - Werribee'
    | 'SUPERVISOR OT - First 3 Hrs - Sunday - Head Office'

type COGSOvertimeAfterThreeHours =
    | 'CGS OT - After 3 Hrs - Balwyn'
    | 'CGS OT - After 3 Hrs - Cheltenham'
    | 'CGS OT - After 3 Hrs - Essendon'
    | 'CGS OT - After 3 Hrs - Geelong'
    | 'CGS OT - After 3 Hrs - Kingsville'
    | 'CGS OT - After 3 Hrs - Malvern'
    | 'CGS OT - After 3 Hrs - Werribee'
    | 'CGS OT - After 3 Hrs - Head Office'

type NonCOGSOvertimeAfterThreeHours =
    | 'NON-CGS OT - After 3 Hrs - Balwyn'
    | 'NON-CGS OT - After 3 Hrs - Cheltenham'
    | 'NON-CGS OT - After 3 Hrs - Essendon'
    | 'NON-CGS OT - After 3 Hrs - Geelong'
    | 'NON-CGS OT - After 3 Hrs - Kingsville'
    | 'NON-CGS OT - After 3 Hrs - Malvern'
    | 'NON-CGS OT - After 3 Hrs - Werribee'
    | 'NON-CGS OT - After 3 Hrs - Head Office'

type SupervisorOvertimeAfterThreeHours =
    | 'SUPERVISOR OT - After 3 Hrs - Balwyn'
    | 'SUPERVISOR OT - After 3 Hrs - Cheltenham'
    | 'SUPERVISOR OT - After 3 Hrs - Essendon'
    | 'SUPERVISOR OT - After 3 Hrs - Geelong'
    | 'SUPERVISOR OT - After 3 Hrs - Kingsville'
    | 'SUPERVISOR OT - After 3 Hrs - Malvern'
    | 'SUPERVISOR OT - After 3 Hrs - Werribee'
    | 'SUPERVISOR OT - After 3 Hrs - Head Office'

export type LaundryAllowancePayItem =
    | 'Laundry Allowance - Balwyn'
    | 'Laundry Allowance - Cheltenham'
    | 'Laundry Allowance - Essendon'
    | 'Laundry Allowance - Geelong'
    | 'Laundry Allowance - Kingsville'
    | 'Laundry Allowance - Malvern'
    | 'Laundry Allowance - Werribee'
    | 'Laundry Allowance - Head Office'

// Ordinary
type CasualOrdinaryMonSat = COGSCasualOrdinaryMonSat | NonCOGSCasualOrdinaryMonSat | SupervisorCasualOrdinaryMonSat

type CasualOrdinarySunday = COGSCasualOrdinarySunday | NonCOGSCasualOrdinarySunday | SupervisorCasualOrdinarySunday

type Under18CasualOrdinaryHoursMonSat =
    | COGSUnder18CasualOrdinaryMonSat
    | NonCOGSUnder18CasualOrdinaryMonSat
    | SupervisorUnder18CasualOrdinaryMonSat

type OrdinaryPayItem =
    | CasualOrdinaryMonSat
    | CasualOrdinarySunday
    | Under18CasualOrdinaryHoursMonSat
    | PTFTOrdinaryMonSat
    | PTFTOrdinaryHoursSunday

// On call
type OnCallPayItem = OnCallCasualOrdinaryMonSat | OnCallCasualOrdinarySunday | Under18OnCallCasualOrdinaryMonSat

// Called in
type CalledInPayItem = CalledInCasualOrdinaryMonSat | CalledInCasualOrdinarySunday | Under18CalledInOrdinaryMonSat

// Overtime
type OvertimeFirstThreeHours =
    | COGSOvertimeFirstThreeHoursMonSat
    | NonCOGSOvertimeFirstThreeHoursMonSat
    | SupervisorOvertimeFirstThreeHoursMonSat
    | COGSOvertimeFirstThreeHoursSunday
    | NonCOGSOvertimeFirstThreeHoursSunday
    | SupervisorOvertimeFirstThreeHoursSunday

type OvertimeAfterThreeHours =
    | COGSOvertimeAfterThreeHours
    | NonCOGSOvertimeAfterThreeHours
    | SupervisorOvertimeAfterThreeHours

type OvertimePayItem = OvertimeFirstThreeHours | OvertimeAfterThreeHours

// Result
type PayItem = OrdinaryPayItem | OnCallPayItem | CalledInPayItem | OvertimePayItem | LaundryAllowancePayItem
