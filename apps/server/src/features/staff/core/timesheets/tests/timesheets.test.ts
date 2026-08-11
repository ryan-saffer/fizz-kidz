import { strictEqual, throws } from 'assert'

import { DateTime } from 'luxon'
import { describe, it } from 'vite-plus/test'

import {
    SlingPosition,
    SlingPositionToId,
    TimesheetRow,
    createTimesheetRows,
    createLaundryAllowanceRows,
    getLaundryAllowancePayItem,
    getShiftsUnderMinimumShiftLength,
    getPositionRate,
    getWeeks,
    hasBirthdayDuring,
    isCalledInShift,
    isLaundryEligibleShift,
    isOnCallShift,
    isSundayShift,
    isSupervisorShift,
    LaundryAllowanceRow,
    LAUNDRY_DAILY_RATE,
    LAUNDRY_FULL_DAYS_PER_WEEK,
    LAUNDRY_WEEKLY_CAP,
    SlingLocationToId,
    type SlingLocation,
} from '../timesheets.utils'

import type { Timesheet } from '@/integrations/sling/sling.types'
import type { Employee } from 'xero-node/dist/gen/model/payroll-au/employee'

const olderThan18 = DateTime.fromObject({ year: 2000, day: 30, month: 5 })
const youngerThan18 = DateTime.fromObject({ year: 2015, day: 1, month: 1 })

const AUS_DATE_FORMAT = 'dd/LL/yyyy'

describe('Timesheet suite', () => {
    describe('breaking down range to weeks', () => {
        it('should be single range for 7 days', () => {
            // given
            const start = DateTime.fromObject({ day: 5, month: 6, year: 2023 }).setZone('Australia/Melbourne')
            const end = DateTime.fromObject({ day: 11, month: 6, year: 2023 }).setZone('Australia/Melbourne')

            // when
            const result = getWeeks(start, end)

            // then
            strictEqual(result.length, 1)
            strictEqual(result[0].start.toFormat(AUS_DATE_FORMAT), '05/06/2023')
            strictEqual(result[0].end.toFormat(AUS_DATE_FORMAT), '11/06/2023')
        })

        it('should be two ranges for 8 days', () => {
            // given
            const start = DateTime.fromObject({ day: 5, month: 6, year: 2023 })
            const end = DateTime.fromObject({ day: 12, month: 6, year: 2023 })

            // when
            const result = getWeeks(start, end)

            // then
            strictEqual(result.length, 2)
            strictEqual(result[0].start.toFormat(AUS_DATE_FORMAT), '05/06/2023')
            strictEqual(result[0].end.toFormat(AUS_DATE_FORMAT), '11/06/2023')
            strictEqual(result[1].start.toFormat(AUS_DATE_FORMAT), '12/06/2023')
            strictEqual(result[1].end.toFormat(AUS_DATE_FORMAT), '12/06/2023')
        })

        it('should be two ranges for 14 days', () => {
            // given
            const start = DateTime.fromObject({ day: 5, month: 6, year: 2023 })
            const end = DateTime.fromObject({ day: 18, month: 6, year: 2023 })

            // when
            const result = getWeeks(start, end)

            // then
            strictEqual(result.length, 2)
            strictEqual(result[0].start.toFormat(AUS_DATE_FORMAT), '05/06/2023')
            strictEqual(result[0].end.toFormat(AUS_DATE_FORMAT), '11/06/2023')
            strictEqual(result[1].start.toFormat(AUS_DATE_FORMAT), '12/06/2023')
            strictEqual(result[1].end.toFormat(AUS_DATE_FORMAT), '18/06/2023')
        })

        it('should be three ranges for 15 days', () => {
            // given
            const start = DateTime.fromObject({ day: 5, month: 6, year: 2023 })
            const end = DateTime.fromObject({ day: 19, month: 6, year: 2023 })

            // when
            const result = getWeeks(start, end)

            // then
            strictEqual(result.length, 3)
            strictEqual(result[0].start.toFormat(AUS_DATE_FORMAT), '05/06/2023')
            strictEqual(result[0].end.toFormat(AUS_DATE_FORMAT), '11/06/2023')
            strictEqual(result[1].start.toFormat(AUS_DATE_FORMAT), '12/06/2023')
            strictEqual(result[1].end.toFormat(AUS_DATE_FORMAT), '18/06/2023')
            strictEqual(result[2].start.toFormat(AUS_DATE_FORMAT), '19/06/2023')
            strictEqual(result[2].end.toFormat(AUS_DATE_FORMAT), '19/06/2023')
        })
    })

    describe('minimum shift length warnings', () => {
        it('should flag monday to saturday shifts under three hours', () => {
            const result = getShiftsUnderMinimumShiftLength({
                firstName: 'Ryan',
                lastName: 'Saffer',
                usersTimesheets: [
                    {
                        status: 'published',
                        dtstart: '2026-04-27T09:00:00+10:00',
                        dtend: '2026-04-27T11:30:00+10:00',
                        user: { id: 1 },
                        position: { id: SlingPositionToId[SlingPosition.PARTY_FACILITATOR] },
                        location: { id: 1 },
                        summary: 'School pickup delay',
                    },
                ],
                timezone: 'Australia/Melbourne',
            })

            strictEqual(result.length, 1)
            strictEqual(result[0].employeeName, 'Ryan Saffer')
            strictEqual(result[0].positionName, 'Party Facilitator')
            strictEqual(result[0].shiftDate, 'Mon 27/04/2026')
            strictEqual(result[0].workedLength, '2 hours 30 minutes')
            strictEqual(result[0].minimumLength, '3 hours')
            strictEqual(result[0].notes, 'School pickup delay')
        })

        it('should flag sunday shifts under four hours', () => {
            const result = getShiftsUnderMinimumShiftLength({
                firstName: 'Ryan',
                lastName: 'Saffer',
                usersTimesheets: [
                    {
                        status: 'published',
                        dtstart: '2026-04-26T09:00:00+10:00',
                        dtend: '2026-04-26T12:30:00+10:00',
                        user: { id: 1 },
                        position: { id: SlingPositionToId[SlingPosition.SUNDAY_PARTY_FACILITATOR] },
                        location: { id: 1 },
                        summary: '',
                    },
                ],
                timezone: 'Australia/Melbourne',
            })

            strictEqual(result.length, 1)
            strictEqual(result[0].employeeName, 'Ryan Saffer')
            strictEqual(result[0].positionName, 'Sunday Party Facilitator')
            strictEqual(result[0].shiftDate, 'Sun 26/04/2026')
            strictEqual(result[0].workedLength, '3 hours 30 minutes')
            strictEqual(result[0].minimumLength, '4 hours')
            strictEqual(result[0].notes, '')
        })

        it('should not flag shifts that meet the minimum length', () => {
            const result = getShiftsUnderMinimumShiftLength({
                firstName: 'Ryan',
                lastName: 'Saffer',
                usersTimesheets: [
                    {
                        status: 'published',
                        dtstart: '2026-04-27T09:00:00+10:00',
                        dtend: '2026-04-27T12:00:00+10:00',
                        user: { id: 1 },
                        position: { id: SlingPositionToId[SlingPosition.PARTY_FACILITATOR] },
                        location: { id: 1 },
                        summary: '',
                    },
                    {
                        status: 'published',
                        dtstart: '2026-04-26T09:00:00+10:00',
                        dtend: '2026-04-26T13:00:00+10:00',
                        user: { id: 1 },
                        position: { id: SlingPositionToId[SlingPosition.SUNDAY_PARTY_FACILITATOR] },
                        location: { id: 1 },
                        summary: '',
                    },
                ],
                timezone: 'Australia/Melbourne',
            })

            strictEqual(result.length, 0)
        })

        it('should fall back to unknown when a shift position cannot be mapped', () => {
            const result = getShiftsUnderMinimumShiftLength({
                firstName: 'Ryan',
                lastName: 'Saffer',
                usersTimesheets: [
                    {
                        status: 'published',
                        dtstart: '2026-04-27T09:00:00+10:00',
                        dtend: '2026-04-27T10:00:00+10:00',
                        user: { id: 1 },
                        position: { id: -1 },
                        location: { id: 1 },
                        summary: '',
                    },
                ],
                timezone: 'Australia/Melbourne',
            })

            strictEqual(result.length, 1)
            strictEqual(result[0].positionName, 'Unknown')
        })

        it('should format worked length in minutes when the shift is under one hour', () => {
            const result = getShiftsUnderMinimumShiftLength({
                firstName: 'Ryan',
                lastName: 'Saffer',
                usersTimesheets: [
                    {
                        status: 'published',
                        dtstart: '2026-04-27T09:00:00+10:00',
                        dtend: '2026-04-27T09:30:00+10:00',
                        user: { id: 1 },
                        position: { id: SlingPositionToId[SlingPosition.PARTY_FACILITATOR] },
                        location: { id: 1 },
                        summary: '',
                    },
                ],
                timezone: 'Australia/Melbourne',
            })

            strictEqual(result.length, 1)
            strictEqual(result[0].workedLength, '30 minutes')
        })

        it('should format worked length with a singular hour when needed', () => {
            const result = getShiftsUnderMinimumShiftLength({
                firstName: 'Ryan',
                lastName: 'Saffer',
                usersTimesheets: [
                    {
                        status: 'published',
                        dtstart: '2026-04-27T09:00:00+10:00',
                        dtend: '2026-04-27T10:30:00+10:00',
                        user: { id: 1 },
                        position: { id: SlingPositionToId[SlingPosition.PARTY_FACILITATOR] },
                        location: { id: 1 },
                        summary: '',
                    },
                ],
                timezone: 'Australia/Melbourne',
            })

            strictEqual(result.length, 1)
            strictEqual(result[0].workedLength, '1 hour 30 minutes')
        })
    })

    describe('Pay Item mappings', () => {
        it('should map on call for all locations mon-sat - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Essen')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Malv')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Head Office')
        })

        it('should map on call for all locations mon-sat - younger than 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Balw')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Essen')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - HO')
        })

        it('should map geelong on call weekday shifts under 18', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 10,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Geelong')
        })

        it('should map geelong on call weekday shifts over 18', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Geelong')
        })

        it('should map on call for all locations on sunday - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Essend')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Head Office')
        })

        it('should map on call for all locations on sunday - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Essend')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Head Office')
        })

        it('should map geelong on call sunday shifts', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Geelong')
        })

        describe('Supervisor shifts', () => {
            const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
            const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })

            const supervisorExpectations = [
                {
                    location: 'balwyn',
                    under18MonSat: 'SUPERVISOR 16&17yo COH - Mon to Sat - Balwyn',
                    monSat: 'SUPERVISOR COH - Mon to Sat - Balwyn',
                    sunday: 'SUPERVISOR COH - Sunday - Balwyn',
                    firstThreeMonSat: 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Balwyn',
                    firstThreeSunday: 'SUPERVISOR OT - First 3 Hrs - Sunday - Balwyn',
                    afterThree: 'SUPERVISOR OT - After 3 Hrs - Balwyn',
                },
                {
                    location: 'cheltenham',
                    under18MonSat: 'SUPERVISOR 16&17yo COH - Mon to Sat - Cheltenham',
                    monSat: 'SUPERVISOR COH - Mon to Sat - Cheltenham',
                    sunday: 'SUPERVISOR COH - Sunday - Cheltenham',
                    firstThreeMonSat: 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Chelt',
                    firstThreeSunday: 'SUPERVISOR OT - First 3 Hrs - Sunday - Cheltenham',
                    afterThree: 'SUPERVISOR OT - After 3 Hrs - Cheltenham',
                },
                {
                    location: 'essendon',
                    under18MonSat: 'SUPERVISOR 16&17yo COH - Mon to Sat - Essendon',
                    monSat: 'SUPERVISOR COH - Mon to Sat - Essendon',
                    sunday: 'SUPERVISOR COH - Sunday - Essendon',
                    firstThreeMonSat: 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Essend',
                    firstThreeSunday: 'SUPERVISOR OT - First 3 Hrs - Sunday - Essendon',
                    afterThree: 'SUPERVISOR OT - After 3 Hrs - Essendon',
                },
                {
                    location: 'geelong',
                    under18MonSat: 'SUPERVISOR 16&17yo COH - Mon to Sat - Geelong',
                    monSat: 'SUPERVISOR COH - Mon to Sat - Geelong',
                    sunday: 'SUPERVISOR COH - Sunday - Geelong',
                    firstThreeMonSat: 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Geelong',
                    firstThreeSunday: 'SUPERVISOR OT - First 3 Hrs - Sunday - Geelong',
                    afterThree: 'SUPERVISOR OT - After 3 Hrs - Geelong',
                },
                {
                    location: 'kingsville',
                    under18MonSat: 'SUPERVISOR 16&17yo COH - Mon to Sat - Kingsville',
                    monSat: 'SUPERVISOR COH - Mon to Sat - Kingsville',
                    sunday: 'SUPERVISOR COH - Sunday - Kingsville',
                    firstThreeMonSat: 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Kings',
                    firstThreeSunday: 'SUPERVISOR OT - First 3 Hrs - Sunday - Kingsville',
                    afterThree: 'SUPERVISOR OT - After 3 Hrs - Kingsville',
                },
                {
                    location: 'malvern',
                    under18MonSat: 'SUPERVISOR 16&17yo COH - Mon to Sat - Malvern',
                    monSat: 'SUPERVISOR COH - Mon to Sat - Malvern',
                    sunday: 'SUPERVISOR COH - Sunday - Malvern',
                    firstThreeMonSat: 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Malvern',
                    firstThreeSunday: 'SUPERVISOR OT - First 3 Hrs - Sunday - Malvern',
                    afterThree: 'SUPERVISOR OT - After 3 Hrs - Malvern',
                },
                {
                    location: 'head-office',
                    under18MonSat: 'SUPERVISOR 16&17yo COH - Mon to Sat - Head Office',
                    monSat: 'SUPERVISOR COH - Mon to Sat - Head Office',
                    sunday: 'SUPERVISOR COH - Sunday - Head Office',
                    firstThreeMonSat: 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - HO',
                    firstThreeSunday: 'SUPERVISOR OT - First 3 Hrs - Sunday - Head Office',
                    afterThree: 'SUPERVISOR OT - After 3 Hrs - Head Office',
                },
            ] as const

            it('should map supervisor casual under 18 ordinary hours on mon-sat for every location', () => {
                supervisorExpectations.forEach(({ location, under18MonSat }) => {
                    const row = new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: youngerThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.SUPERVISOR_PARTY,
                        location,
                        hours: 5,
                        rate: 10,
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    })

                    strictEqual(
                        row.payItem,
                        under18MonSat,
                        `${location} should map to supervisor under-18 Mon-Sat ordinary hours`
                    )
                })
            })

            it('should map supervisor casual ordinary hours on mon-sat for every location', () => {
                supervisorExpectations.forEach(({ location, monSat }) => {
                    const row = new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.SUPERVISOR_PARTY,
                        location,
                        hours: 5,
                        rate: 20,
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    })

                    strictEqual(row.payItem, monSat, `${location} should map to supervisor Mon-Sat ordinary hours`)
                })
            })

            it('should map supervisor casual ordinary hours on sunday for every location', () => {
                supervisorExpectations.forEach(({ location, sunday: expectedSunday }) => {
                    const row = new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: sunday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.SUNDAY_SUPERVISOR_PARTY,
                        location,
                        hours: 5,
                        rate: 20,
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    })

                    strictEqual(
                        row.payItem,
                        expectedSunday,
                        `${location} should map to supervisor Sunday ordinary hours`
                    )
                })
            })

            it('should map supervisor overtime first three hours on mon-sat for every location', () => {
                supervisorExpectations.forEach(({ location, firstThreeMonSat }) => {
                    const row = new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.SUPERVISOR_PARTY,
                        location,
                        hours: 3,
                        rate: 20,
                        summary: '',
                        overtime: { firstThreeHours: true, afterThreeHours: false },
                    })

                    strictEqual(
                        row.payItem,
                        firstThreeMonSat,
                        `${location} should map to supervisor Mon-Sat first-3 overtime`
                    )
                })
            })

            it('should map supervisor overtime first three hours on sunday for every location', () => {
                supervisorExpectations.forEach(({ location, firstThreeSunday }) => {
                    const row = new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: sunday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.SUNDAY_SUPERVISOR_PARTY,
                        location,
                        hours: 3,
                        rate: 20,
                        summary: '',
                        overtime: { firstThreeHours: true, afterThreeHours: false },
                    })

                    strictEqual(
                        row.payItem,
                        firstThreeSunday,
                        `${location} should map to supervisor Sunday first-3 overtime`
                    )
                })
            })

            it('should map supervisor overtime after three hours for every location', () => {
                supervisorExpectations.forEach(({ location, afterThree }) => {
                    const row = new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.SUPERVISOR_PARTY,
                        location,
                        hours: 4,
                        rate: 20,
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: true },
                    })

                    strictEqual(
                        row.payItem,
                        afterThree,
                        `${location} should map to supervisor overtime after three hours`
                    )
                })
            })
        })

        it('should map called in party facilitator for all locations mon-sat - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Essen')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Head Office')
        })

        it('should map called in party facilitator for all locations mon-sat - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Balw')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Essen')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Malv')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 COH - Mon to Sat - HO')
        })

        it('should map geelong called in weekday shifts under 18', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 10,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Geel')
        })

        it('should map geelong called in weekday shifts over 18', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Geelong')
        })

        it('should map called in holiday program facilitator for all locations mon-sat - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Essen')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Head Office')
        })

        it('should map called in holiday program facilitator for all locations mon-sat - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Balw')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Essen')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Malv')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 2, month: 5, year: 2023 }), // tuesday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 COH - Mon to Sat - HO')
        })

        it('should map called in party facilitator for all locations sunday - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Essend')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Head Office')
        })

        it('should map called in party facilitator for all locations sunday - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Essend')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Head Office')
        })

        it('should map geelong called in sunday shifts', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Geelong')
        })

        it('should map called in holiday program facilitator for all locations sunday - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Essend')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Head Office')
        })

        it('should map called in holiday program facilitator for all locations sunday - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Essend')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Head Office')
        })

        it('should map party faciliator for all locations mon-sat - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Head Office')
        })

        it('should map geelong casual ordinary weekday shifts over 18', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Geelong')
        })

        it('should map party faciliator for all locations mon-sat - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Head Office')
        })

        it('should map geelong casual ordinary weekday shifts under 18', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 10,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Geelong')
        })

        it('should map party faciliator for all locations sunday - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Head Office')
        })

        it('should map party faciliator for all locations sunday - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Head Office')
        })

        it('should map geelong casual ordinary sunday shifts', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'CGS COH - Sunday - Geelong')
        })

        it('should map holiday program facilitator for all locations mon-sat - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Head Office')
        })

        it('should map holiday program facilitator for all locations mon-sat - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Head Office')
        })

        it('should map holiday program facilitator for all locations sunday - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Head Office')
        })

        it('should map holiday program facilitator for all locations sunday - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.HOLIDAY_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Head Office')
        })

        it('should map science club facilitator for all locations mon-sat - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Head Office')
        })

        it('should map science club facilitator for all locations mon-sat - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Head Office')
        })

        it('should map science club facilitator for all locations sunday - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Head Office')
        })

        it('should map science club facilitator for all locations sunday - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Head Office')
        })

        it('should map miscellaneous for all locations mon-sat - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Head Office')
        })

        it('should map miscellaneous for all locations mon-sat - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Head Office')
        })

        it('should map miscellaneous for all locations sunday - over 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Head Office')
        })

        it('should map miscellaneous for all locations sunday - under 18', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Head Office')
        })

        it('should map non casual staff to ordinary hours mon-sat', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Mon to Sat - Head Office')
        })

        it('should map non casual staff to ordinary hours sunday', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Sunday - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Sunday - Head Office')
        })

        it('should map geelong non casual ordinary hours on weekdays', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Mon to Sat - Geelong')
        })

        it('should map geelong non casual ordinary hours on sundays', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.SUNDAY_PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Sunday - Geelong')
        })

        it('should map overtime first three hours - mon to sat', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Mon to Sat - HO')
        })

        it('should map overtime first three hours - sunday', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Sunday - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Sunday - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Sunday - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Sunday - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Sunday - Head Office')
        })

        it('should map CGS overtime first three hours - mon to sat', () => {
            const baseProps = {
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            } as const

            const scenarios = [
                { location: 'balwyn', expected: 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn' },
                { location: 'cheltenham', expected: 'CGS OT - First 3 Hrs - Mon to Sat - Cheltenham' },
                { location: 'essendon', expected: 'CGS OT - First 3 Hrs - Mon to Sat - Essendon' },
                { location: 'kingsville', expected: 'CGS OT - First 3 Hrs - Mon to Sat - Kingsville' },
                { location: 'malvern', expected: 'CGS OT - First 3 Hrs - Mon to Sat - Malvern' },
                { location: 'head-office', expected: 'CGS OT - First 3 Hrs - Mon to Sat - Head Office' },
            ] as const

            scenarios.forEach(({ location, expected }) => {
                const row = new TimesheetRow({ ...baseProps, location })
                strictEqual(row.payItem, expected)
            })
        })

        it('should map CGS overtime first three hours - sunday', () => {
            const baseProps = {
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            } as const

            const scenarios = [
                { location: 'balwyn', expected: 'CGS OT - First 3 Hrs - Sunday - Balwyn' },
                { location: 'cheltenham', expected: 'CGS OT - First 3 Hrs - Sunday - Cheltenham' },
                { location: 'essendon', expected: 'CGS OT - First 3 Hrs - Sunday - Essendon' },
                { location: 'kingsville', expected: 'CGS OT - First 3 Hrs - Sunday - Kingsville' },
                { location: 'malvern', expected: 'CGS OT - First 3 Hrs - Sunday - Malvern' },
                { location: 'head-office', expected: 'CGS OT - First 3 Hrs - Sunday - Head Office' },
            ] as const

            scenarios.forEach(({ location, expected }) => {
                const row = new TimesheetRow({ ...baseProps, location })
                strictEqual(row.payItem, expected)
            })
        })

        it('should map geelong overtime first three hours on weekdays', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Geelong')
        })

        it('should map geelong overtime first three hours on sundays', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })

            strictEqual(row.payItem, 'CGS OT - First 3 Hrs - Sunday - Geelong')
        })

        it('should map overtime after three hours', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
            strictEqual(row.payItem, 'NON-CGS OT - After 3 Hrs - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
            strictEqual(row.payItem, 'NON-CGS OT - After 3 Hrs - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
            strictEqual(row.payItem, 'NON-CGS OT - After 3 Hrs - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
            strictEqual(row.payItem, 'NON-CGS OT - After 3 Hrs - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 7, month: 5, year: 2023 }), // sunday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
            strictEqual(row.payItem, 'NON-CGS OT - After 3 Hrs - Head Office')
        })

        it('should map CGS overtime after three hours', () => {
            const baseProps = {
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            } as const

            const scenarios = [
                { location: 'balwyn', expected: 'CGS OT - After 3 Hrs - Balwyn' },
                { location: 'cheltenham', expected: 'CGS OT - After 3 Hrs - Cheltenham' },
                { location: 'essendon', expected: 'CGS OT - After 3 Hrs - Essendon' },
                { location: 'kingsville', expected: 'CGS OT - After 3 Hrs - Kingsville' },
                { location: 'malvern', expected: 'CGS OT - After 3 Hrs - Malvern' },
                { location: 'head-office', expected: 'CGS OT - After 3 Hrs - Head Office' },
            ] as const

            scenarios.forEach(({ location, expected }) => {
                const row = new TimesheetRow({ ...baseProps, location })
                strictEqual(row.payItem, expected)
            })
        })

        it('should map geelong overtime after three hours', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'geelong',
                hours: 8,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })

            strictEqual(row.payItem, 'CGS OT - After 3 Hrs - Geelong')
        })

        it('should map casual ordinary hours for employees under 18 on a rate above $18 on mon-sat to over 18 mon-sat', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Head Office')
        })

        it('should map casual ordinary hours for employees under 18 on a rate under $18 on mon-sat to under 18 mon-sat', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'cheltenham',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Cheltenham')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'essendon',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Essendon')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'malvern',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'head-office',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Head Office')
        })

        it('should choose CGS for COGS shifts and NON-CGS for non-COGS shifts', () => {
            const baseArgs = {
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                hours: 4,
                rate: 'not required' as const,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false } as const,
            }

            const cogsRow = new TimesheetRow({
                ...baseArgs,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'balwyn',
            })
            strictEqual(cogsRow.payItem, 'CGS 16&17yo COH - Mon to Sat - Balwyn')

            const nonCogsRow = new TimesheetRow({
                ...baseArgs,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
            })
            strictEqual(nonCogsRow.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Balwyn')
        })

        it('should choose CGS vs NON-CGS for overtime first three hours', () => {
            const baseArgs = {
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 6, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: false,
                isCasual: false,
                hours: 2,
                rate: 'not required' as const,
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false } as const,
            }

            const cogsRow = new TimesheetRow({
                ...baseArgs,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'balwyn',
            })
            strictEqual(cogsRow.payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')

            const nonCogsRow = new TimesheetRow({
                ...baseArgs,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
            })
            strictEqual(nonCogsRow.payItem, 'NON-CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
        })

        it('should choose CGS vs NON-CGS for overtime after three hours', () => {
            const baseArgs = {
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 6, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: false,
                isCasual: false,
                hours: 2,
                rate: 'not required' as const,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true } as const,
            }

            const cogsRow = new TimesheetRow({
                ...baseArgs,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'balwyn',
            })
            strictEqual(cogsRow.payItem, 'CGS OT - After 3 Hrs - Balwyn')

            const nonCogsRow = new TimesheetRow({
                ...baseArgs,
                position: SlingPosition.MISCELLANEOUS,
                location: 'balwyn',
            })
            strictEqual(nonCogsRow.payItem, 'NON-CGS OT - After 3 Hrs - Balwyn')
        })

        it('should map kingsville ordinary and pt/ft pay items', () => {
            const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
            const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })

            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 4,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS 16&17yo COH - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'kingsville',
                hours: 4,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 4,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'kingsville',
                hours: 4,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: sunday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 4,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS COH - Sunday - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: sunday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'kingsville',
                hours: 4,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 4,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: sunday,
                hasBirthdayDuringPayrun: false,
                isCasual: false,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 4,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'PT/FT Ordinary Hours - Sunday - Kingsville')
        })

        it('should map kingsville on call and called in pay items', () => {
            const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
            const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })

            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'kingsville',
                hours: 3,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Kings')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'kingsville',
                hours: 3,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: sunday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'kingsville',
                hours: 3,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Sunday - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 3,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Kings')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 3,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: sunday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 3,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CALLEDIN - Cas Ord Hrs - Sun - Kingsville')
        })

        it('should map kingsville overtime pay items', () => {
            const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
            const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })

            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 2,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'kingsville',
                hours: 2,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Mon to Sat - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: sunday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 2,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'CGS OT - First 3 Hrs - Sunday - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: sunday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'kingsville',
                hours: 2,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Sunday - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'kingsville',
                hours: 2,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
            strictEqual(row.payItem, 'CGS OT - After 3 Hrs - Kingsville')

            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: monday,
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.MISCELLANEOUS,
                location: 'kingsville',
                hours: 2,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
            strictEqual(row.payItem, 'NON-CGS OT - After 3 Hrs - Kingsville')
        })

        it('should map on call for employees under 18 on a rate above $18 on mon-sat to over 18 mon-sat', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Balwyn')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Essen')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Malv')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 14.4,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Head Office')
        })

        it('should map casual ordinary hours for employees under 18 on a rate under $18 on mon-sat to under 18 mon-sat', () => {
            // balwyn
            let row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'balwyn',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Balw')

            // cheltenham
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'cheltenham',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Chelt')

            // essendon
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'essendon',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Essen')

            // malvern
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'malvern',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - Malvern')

            // mobile
            row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: youngerThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }), // monday
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                location: 'head-office',
                hours: 8,
                rate: 14.3,
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'On call - 16&17yo Csl Or Hs - Mon to Sat - HO')
        })
    })

    describe('getPositionRate', () => {
        it('should return 1.8 for under 18 on-call weekday shifts with low rates', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.ON_CALL_PARTY_FACILITATOR],
                rate: 10,
                dob: youngerThan18,
            })

            // then
            strictEqual(result, '1.8')
        })

        it('should calculate weekday on-call rate multiplier for adults or higher rates', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.ON_CALL_PARTY_FACILITATOR],
                rate: 20,
                dob: olderThan18,
            })

            // then
            strictEqual(result, '2.5000')
        })

        it('should calculate sunday on-call rate multiplier', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR],
                rate: 20,
                dob: olderThan18,
            })

            // then
            strictEqual(result, '3.5000')
        })

        it('should return 27 for under 18 called-in weekday shifts with low rates', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.CALLED_IN_PARTY_FACILITATOR],
                rate: 10,
                dob: youngerThan18,
            })

            // then
            strictEqual(result, '27')
        })

        it('should calculate weekday called-in rate multiplier for adults or higher rates', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.CALLED_IN_PARTY_FACILITATOR],
                rate: 20,
                dob: olderThan18,
            })

            // then
            strictEqual(result, '37.5000')
        })

        it('should calculate sunday called-in rate multiplier', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR],
                rate: 20,
                dob: olderThan18,
            })

            // then
            strictEqual(result, '52.5000')
        })

        it('should return 18 for under 18 ordinary weekday shifts with low rates', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.PARTY_FACILITATOR],
                rate: 10,
                dob: youngerThan18,
            })

            // then
            strictEqual(result, '18')
        })

        it('should calculate weekday ordinary rate multiplier for adults or higher rates', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.PARTY_FACILITATOR],
                rate: 20,
                dob: olderThan18,
            })

            // then
            strictEqual(result, '25.0000')
        })

        it('should calculate sunday ordinary rate multiplier', () => {
            // when
            const result = getPositionRate({
                positionId: SlingPositionToId[SlingPosition.SUNDAY_PARTY_FACILITATOR],
                rate: 20,
                dob: olderThan18,
            })

            // then
            strictEqual(result, '35.0000')
        })
    })

    describe('Guard clauses', () => {
        it('should throw on unrecognised position while determining COGS shift', () => {
            const invalidPosition = 'INVALID_POSITION' as SlingPosition
            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: invalidPosition,
                        location: 'balwyn',
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised position when asking/
            )
        })

        it('should throw on unhandled position while checking if a shift is COGS', () => {
            const row = new TimesheetRow({
                firstName: 'Ryan',
                lastName: 'Saffer',
                dob: olderThan18,
                date: DateTime.fromObject({ day: 1, month: 5, year: 2023 }),
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                position: SlingPosition.PARTY_FACILITATOR,
                location: 'balwyn',
                hours: 1,
                rate: 'not required',
                summary: '',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })

            ;(row as any).position = 'INVALID_POSITION'

            throws(() => (row as any)._isCOGSShift(), /Unhandled position while determining COGS shift/)
        })

        it('should throw on unrecognised position when asking isCalledInShift', () => {
            const invalidPosition = 'INVALID_POSITION' as SlingPosition
            throws(() => isCalledInShift(invalidPosition), /Unrecognised position when asking isCalledInShift/)
        })

        it('should throw on unrecognised location for ordinary pay items', () => {
            const invalidLocation = 'INVALID_LOCATION' as SlingLocation
            const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
            const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: youngerThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.MISCELLANEOUS,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: sunday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.MISCELLANEOUS,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: false,
                        position: SlingPosition.PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: sunday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: false,
                        position: SlingPosition.PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )
        })

        it('should throw on unrecognised location for on call pay items', () => {
            const invalidLocation = 'INVALID_LOCATION' as SlingLocation
            const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
            const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: youngerThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: sunday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )
        })

        it('should throw on unrecognised location for called in pay items', () => {
            const invalidLocation = 'INVALID_LOCATION' as SlingLocation
            const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
            const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: youngerThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: sunday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: false, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )
        })

        it('should throw on unrecognised location for overtime pay items', () => {
            const invalidLocation = 'INVALID_LOCATION' as SlingLocation
            const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
            const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: monday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: true, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: sunday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: true, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )

            throws(
                () =>
                    new TimesheetRow({
                        firstName: 'Ryan',
                        lastName: 'Saffer',
                        dob: olderThan18,
                        date: sunday,
                        hasBirthdayDuringPayrun: false,
                        isCasual: true,
                        position: SlingPosition.PARTY_FACILITATOR,
                        location: invalidLocation,
                        hours: 1,
                        rate: 'not required',
                        summary: '',
                        overtime: { firstThreeHours: true, afterThreeHours: false },
                    }),
                /Unrecognised location processing payroll/
            )
        })

        it('should throw on unrecognised position when asking isSundayShift', () => {
            throws(
                () => isSundayShift('INVALID_POSITION' as SlingPosition),
                /Unrecognised position when asking isCalledInShift/
            )
        })

        it('should throw on unrecognised position when asking isSupervisorShift', () => {
            throws(
                () => isSupervisorShift('INVALID_POSITION' as SlingPosition),
                /Unhandled position while determining isSupervisorShift/
            )
        })
    })

    describe('isOnCallShift', () => {
        it('should return true for every on call position', () => {
            const onCallPositions: SlingPosition[] = [
                SlingPosition.ON_CALL_PARTY_FACILITATOR,
                SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR,
                SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR,
                SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR,
                SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR,
                SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR,
                SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
                SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR,
                SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR,
                SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS,
                SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS,
                SlingPosition.ON_CALL_INCURSIONS,
                SlingPosition.SUNDAY_ON_CALL_INCURSIONS,
                SlingPosition.PIC,
                SlingPosition.SUNDAY_PIC,
                SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR,
            ]

            onCallPositions.forEach((position) => {
                strictEqual(isOnCallShift(position), true, `${position} should be treated as an on call shift`)
            })
        })
    })

    describe('Creating timesheet rows', () => {
        const xeroUser: Employee = {
            firstName: 'Ryan',
            lastName: 'Saffer',
            dateOfBirth: DateTime.fromObject({ day: 2, month: 5, year: 1993 }).toISO(),
        }
        it('should not reach overtime - non casual - 30 hours', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: false,
                isCasual: false,
                overtimeThreshold: 30,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 3)

            strictEqual(rows[0].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 10)
        })

        it('should reach overtime - non casual - 40 hours - first overtime shift over 3 hours', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 10 hours
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 8 hours
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T18:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 7 hours (first 2 should okay, then next 5 overtime. first three should be under three hours, then last 2 over three hours)
                    dtstart: '2023-05-04T10:00:00+10:00',
                    dtend: '2023-05-04T17:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 5 hours
                    dtstart: '2023-05-05T10:00:00+10:00',
                    dtend: '2023-05-05T15:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: false,
                isCasual: false,
                overtimeThreshold: 30,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 7)

            strictEqual(rows[0].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 8)

            strictEqual(rows[3].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[3].hours, 2)

            strictEqual(rows[4].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[4].hours, 3)

            strictEqual(rows[5].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[5].hours, 2)

            strictEqual(rows[6].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[6].hours, 5)
        })

        it('should reach overtime - non casual - 40 hours - first overtime shift under 3 hours', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 10 hours
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 8 hours
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T18:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 4 hours (first 2 should okay, then next 2 overtime, under three hours.)
                    dtstart: '2023-05-04T10:00:00+10:00',
                    dtend: '2023-05-04T14:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 5 hours (first hour under three hours overtime, next 4 over three hours)
                    dtstart: '2023-05-05T10:00:00+10:00',
                    dtend: '2023-05-05T15:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: false,
                overtimeThreshold: 30,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 7)

            strictEqual(rows[0].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 8)

            strictEqual(rows[3].payItem, 'PT/FT Ordinary Hours - Mon to Sat - Balwyn')
            strictEqual(rows[3].hours, 2)

            strictEqual(rows[4].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[4].hours, 2)

            strictEqual(rows[5].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[5].hours, 1)

            strictEqual(rows[6].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[6].hours, 4)
        })

        it('should not reach overtime - casual - 38 hours', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    dtstart: '2023-05-04T10:00:00+10:00',
                    dtend: '2023-05-04T18:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 4)

            strictEqual(rows[0].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 10)

            strictEqual(rows[3].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[3].hours, 8)
        })

        it('should reach overtime - casual - 48 hours - first overtime shift over 3 hours', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 10 hours
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 6 hours
                    dtstart: '2023-05-04T10:00:00+10:00',
                    dtend: '2023-05-04T16:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 7 hours (first 2 should okay, then next 5 overtime. first three should be under three hours, then last 2 over three hours)
                    dtstart: '2023-05-05T10:00:00+10:00',
                    dtend: '2023-05-05T17:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 5 hours
                    dtstart: '2023-05-06T10:00:00+10:00',
                    dtend: '2023-05-06T15:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: false,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 8)

            strictEqual(rows[0].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 10)

            strictEqual(rows[3].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[3].hours, 6)

            strictEqual(rows[4].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[4].hours, 2)

            strictEqual(rows[5].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[5].hours, 3)

            strictEqual(rows[6].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[6].hours, 2)

            strictEqual(rows[7].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[7].hours, 5)
        })

        it('should reach overtime - casual - 48 hours - first overtime shift under 3 hours', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 10 hours
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 6 hours
                    dtstart: '2023-05-04T10:00:00+10:00',
                    dtend: '2023-05-04T16:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 4 hours (first 2 should okay, then next 2 overtime, under three hours.)
                    dtstart: '2023-05-05T10:00:00+10:00',
                    dtend: '2023-05-05T14:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 5 hours (first hour under three hours overtime, next 4 over three hours)
                    dtstart: '2023-05-06T10:00:00+10:00',
                    dtend: '2023-05-06T15:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 8)

            strictEqual(rows[0].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 10)

            strictEqual(rows[3].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[3].hours, 6)

            strictEqual(rows[4].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[4].hours, 2)

            strictEqual(rows[5].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[5].hours, 2)

            strictEqual(rows[6].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[6].hours, 1)

            strictEqual(rows[7].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[7].hours, 4)
        })

        it('should go into overtime if shift length is more than 10 hours - 3 hours over', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 10 hours
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T23:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 2)

            strictEqual(rows[0].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 3)
        })

        it('should go into overtime if shift length is more than 10 hours - 8 hours over', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 18 hours
                    dtstart: '2023-05-01T00:00:00+10:00',
                    dtend: '2023-05-01T18:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 3)

            strictEqual(rows[0].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 3)

            strictEqual(rows[2].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[2].hours, 5)
        })

        it('should calculate correct overtime if shift over 10 hours done within 10 hours of overtime', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 10 hours
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 3 hours
                    dtstart: '2023-05-04T10:00:00+10:00',
                    dtend: '2023-05-04T13:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 12 hours - only 5 hours left until overtime
                    dtstart: '2023-05-05T10:00:00+10:00',
                    dtend: '2023-05-05T22:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 7)

            strictEqual(rows[0].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 10)

            strictEqual(rows[3].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[3].hours, 3)

            strictEqual(rows[4].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[4].hours, 5)

            strictEqual(rows[5].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[5].hours, 3)

            strictEqual(rows[6].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[6].hours, 4)
        })

        it('should calculate correct overtime if shift over 10 hours (but 13 or under) done but not within 10 hours of overtime', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 10 hours
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 4 hours - 14 hours until overtime
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T14:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 13 hours - first 10 should be normal, then 3 hours overtime
                    dtstart: '2023-05-04T00:00:00+10:00',
                    dtend: '2023-05-04T13:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 5 hours - first hour normal, but then rest overtime
                    dtstart: '2023-05-05T10:00:00+10:00',
                    dtend: '2023-05-05T15:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 8)

            strictEqual(rows[0].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 4)

            strictEqual(rows[3].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[3].hours, 10)

            strictEqual(rows[4].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[4].hours, 3)

            strictEqual(rows[5].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[5].hours, 1)

            strictEqual(rows[6].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[6].hours, 3)

            strictEqual(rows[7].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[7].hours, 1)
        })

        it('should calculate correct overtime if shift over 10 hours (above 13) done but not within 10 hours of overtime', () => {
            // given
            const timesheets: Timesheet[] = [
                {
                    // 10 hours
                    dtstart: '2023-05-01T10:00:00+10:00',
                    dtend: '2023-05-01T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 10 hours
                    dtstart: '2023-05-02T10:00:00+10:00',
                    dtend: '2023-05-02T20:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 3 hours - 15 hours until overtime
                    dtstart: '2023-05-03T10:00:00+10:00',
                    dtend: '2023-05-03T13:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 14 hours - first 10 should be normal, then 4 hours overtime
                    dtstart: '2023-05-04T00:00:00+10:00',
                    dtend: '2023-05-04T14:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
                {
                    // 5 hours - first hour normal, but then rest overtime
                    dtstart: '2023-05-05T10:00:00+10:00',
                    dtend: '2023-05-05T15:00:00+10:00',
                    location: { id: 4809521 }, // balwyn
                    position: { id: 4809533 }, // party facilitator
                    user: { id: 123 },
                    status: 'published',
                    summary: '',
                },
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 9)

            strictEqual(rows[0].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[0].hours, 10)

            strictEqual(rows[1].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[1].hours, 10)

            strictEqual(rows[2].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[2].hours, 3)

            strictEqual(rows[3].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[3].hours, 10)

            strictEqual(rows[4].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[4].hours, 3)

            strictEqual(rows[5].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[5].hours, 1)

            strictEqual(rows[6].payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(rows[6].hours, 1)

            strictEqual(rows[7].payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(rows[7].hours, 3)

            strictEqual(rows[8].payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(rows[8].hours, 1)
        })

        const buildTimesheet = (dtstart: string, dtend: string, positionId: number): Timesheet => ({
            dtstart,
            dtend,
            location: { id: 4809521 }, // balwyn
            position: { id: positionId },
            user: { id: 123 },
            status: 'published',
            summary: '',
        })

        it('should keep on call pay items when shift crosses the weekly overtime threshold', () => {
            // given
            const timesheets: Timesheet[] = [
                buildTimesheet(
                    '2023-05-01T10:00:00+10:00',
                    '2023-05-01T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-02T10:00:00+10:00',
                    '2023-05-02T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-03T10:00:00+10:00',
                    '2023-05-03T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-04T10:00:00+10:00',
                    '2023-05-04T16:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 6-hour shift
                buildTimesheet(
                    '2023-05-05T10:00:00+10:00',
                    '2023-05-05T14:00:00+10:00',
                    SlingPositionToId[SlingPosition.ON_CALL_PARTY_FACILITATOR]
                ), // on call, 4-hour shift
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 5)

            const onCallRow = rows[rows.length - 1]

            strictEqual(onCallRow.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Balwyn')
            strictEqual(onCallRow.hours, 4)
            strictEqual(onCallRow.overtime.firstThreeHours, false)
            strictEqual(onCallRow.overtime.afterThreeHours, false)
        })

        it('should keep on call pay items when an entire shift occurs inside weekly overtime', () => {
            // given
            const timesheets: Timesheet[] = [
                buildTimesheet(
                    '2023-05-01T10:00:00+10:00',
                    '2023-05-01T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-02T10:00:00+10:00',
                    '2023-05-02T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-03T10:00:00+10:00',
                    '2023-05-03T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-04T10:00:00+10:00',
                    '2023-05-04T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-05T10:00:00+10:00',
                    '2023-05-05T13:00:00+10:00',
                    SlingPositionToId[SlingPosition.ON_CALL_PARTY_FACILITATOR]
                ), // on call, 3-hour shift
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 6)

            const onCallRow = rows[rows.length - 1]

            strictEqual(onCallRow.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Balwyn')
            strictEqual(onCallRow.hours, 3)
            strictEqual(onCallRow.overtime.firstThreeHours, false)
            strictEqual(onCallRow.overtime.afterThreeHours, false)
        })

        it('should ignore on call hours when determining weekly overtime for later shifts', () => {
            // given
            const timesheets: Timesheet[] = [
                buildTimesheet(
                    '2023-05-01T10:00:00+10:00',
                    '2023-05-01T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-02T10:00:00+10:00',
                    '2023-05-02T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-03T10:00:00+10:00',
                    '2023-05-03T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-04T10:00:00+10:00',
                    '2023-05-04T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.ON_CALL_PARTY_FACILITATOR]
                ), // on call, 10-hour shift
                buildTimesheet(
                    '2023-05-05T10:00:00+10:00',
                    '2023-05-05T18:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 8-hour shift
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 5)

            const onCallRow = rows[3]
            strictEqual(onCallRow.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Balwyn')
            strictEqual(onCallRow.hours, 10)
            strictEqual(onCallRow.overtime.firstThreeHours, false)
            strictEqual(onCallRow.overtime.afterThreeHours, false)

            const ordinaryRow = rows[4]
            strictEqual(ordinaryRow.payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(ordinaryRow.hours, 8)
            strictEqual(ordinaryRow.overtime.firstThreeHours, false)
            strictEqual(ordinaryRow.overtime.afterThreeHours, false)
        })

        it('should not treat long on call shifts as overtime even when crossing the weekly threshold', () => {
            // given
            const timesheets: Timesheet[] = [
                buildTimesheet(
                    '2023-05-01T10:00:00+10:00',
                    '2023-05-01T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-02T10:00:00+10:00',
                    '2023-05-02T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-03T10:00:00+10:00',
                    '2023-05-03T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-04T08:00:00+10:00',
                    '2023-05-04T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.ON_CALL_PARTY_FACILITATOR]
                ), // on call, 12-hour shift
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 4)

            const onCallRow = rows[3]
            strictEqual(onCallRow.payItem, 'ON CALL - Cas Ord Hrs - Mon to Sat - Balwyn')
            strictEqual(onCallRow.hours, 12)
            strictEqual(onCallRow.overtime.firstThreeHours, false)
            strictEqual(onCallRow.overtime.afterThreeHours, false)
        })

        it('should keep called in pay items when shift crosses the weekly overtime threshold', () => {
            // given
            const timesheets: Timesheet[] = [
                buildTimesheet(
                    '2023-05-01T10:00:00+10:00',
                    '2023-05-01T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-02T10:00:00+10:00',
                    '2023-05-02T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-03T10:00:00+10:00',
                    '2023-05-03T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-04T10:00:00+10:00',
                    '2023-05-04T16:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 6-hour shift
                buildTimesheet(
                    '2023-05-05T10:00:00+10:00',
                    '2023-05-05T14:00:00+10:00',
                    SlingPositionToId[SlingPosition.CALLED_IN_PARTY_FACILITATOR]
                ), // called in, 4-hour shift
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 6)

            const [firstSegment, secondSegment] = rows.slice(-2)

            strictEqual(firstSegment.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Balwyn')
            strictEqual(firstSegment.hours, 2)
            strictEqual(firstSegment.overtime.firstThreeHours, false)
            strictEqual(firstSegment.overtime.afterThreeHours, false)

            strictEqual(secondSegment.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Balwyn')
            strictEqual(secondSegment.hours, 2)
            strictEqual(secondSegment.overtime.firstThreeHours, true)
            strictEqual(secondSegment.overtime.afterThreeHours, false)
        })

        it('should keep called in pay items when an entire shift occurs inside weekly overtime', () => {
            // given
            const timesheets: Timesheet[] = [
                buildTimesheet(
                    '2023-05-01T10:00:00+10:00',
                    '2023-05-01T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-02T10:00:00+10:00',
                    '2023-05-02T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-03T10:00:00+10:00',
                    '2023-05-03T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-04T10:00:00+10:00',
                    '2023-05-04T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-05T10:00:00+10:00',
                    '2023-05-05T13:00:00+10:00',
                    SlingPositionToId[SlingPosition.CALLED_IN_PARTY_FACILITATOR]
                ), // called in, 3-hour shift
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 7)

            const [firstSegment, secondSegment] = rows.slice(-2)

            strictEqual(firstSegment.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Balwyn')
            strictEqual(firstSegment.hours, 1)
            strictEqual(firstSegment.overtime.firstThreeHours, true)
            strictEqual(firstSegment.overtime.afterThreeHours, false)

            strictEqual(secondSegment.payItem, 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Balwyn')
            strictEqual(secondSegment.hours, 2)
            strictEqual(secondSegment.overtime.firstThreeHours, false)
            strictEqual(secondSegment.overtime.afterThreeHours, true)
        })

        it('should switch ordinary shifts to overtime pay items once overtime is reached', () => {
            // given
            const timesheets: Timesheet[] = [
                buildTimesheet(
                    '2023-05-01T10:00:00+10:00',
                    '2023-05-01T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-02T10:00:00+10:00',
                    '2023-05-02T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-03T10:00:00+10:00',
                    '2023-05-03T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-04T10:00:00+10:00',
                    '2023-05-04T16:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 6-hour shift
                buildTimesheet(
                    '2023-05-05T10:00:00+10:00',
                    '2023-05-05T14:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 4-hour shift
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 6)

            const [firstSegment, secondSegment] = rows.slice(-2)

            strictEqual(firstSegment.payItem, 'CGS COH - Mon to Sat - Balwyn')
            strictEqual(firstSegment.hours, 2)
            strictEqual(firstSegment.overtime.firstThreeHours, false)
            strictEqual(firstSegment.overtime.afterThreeHours, false)

            strictEqual(secondSegment.payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(secondSegment.hours, 2)
            strictEqual(secondSegment.overtime.firstThreeHours, true)
            strictEqual(secondSegment.overtime.afterThreeHours, false)
        })

        it('should pay overtime rates for ordinary shifts worked entirely after the weekly threshold', () => {
            // given
            const timesheets: Timesheet[] = [
                buildTimesheet(
                    '2023-05-01T10:00:00+10:00',
                    '2023-05-01T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-02T10:00:00+10:00',
                    '2023-05-02T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-03T10:00:00+10:00',
                    '2023-05-03T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-04T10:00:00+10:00',
                    '2023-05-04T20:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 10-hour shift
                buildTimesheet(
                    '2023-05-05T10:00:00+10:00',
                    '2023-05-05T13:00:00+10:00',
                    SlingPositionToId[SlingPosition.PARTY_FACILITATOR]
                ), // 3-hour shift
            ]

            // when
            const { rows } = createTimesheetRows({
                firstName: xeroUser.firstName,
                lastName: xeroUser.lastName,
                dob: DateTime.fromISO(xeroUser.dateOfBirth),
                hasBirthdayDuringPayrun: true,
                isCasual: true,
                overtimeThreshold: 38,
                usersTimesheets: timesheets,
                rate: 'not required',
                timezone: 'Australia/Melbourne',
            })

            // then
            strictEqual(rows.length, 7)

            const [firstSegment, secondSegment] = rows.slice(-2)

            strictEqual(firstSegment.payItem, 'CGS OT - First 3 Hrs - Mon to Sat - Balwyn')
            strictEqual(firstSegment.hours, 1)
            strictEqual(firstSegment.overtime.firstThreeHours, true)
            strictEqual(firstSegment.overtime.afterThreeHours, false)

            strictEqual(secondSegment.payItem, 'CGS OT - After 3 Hrs - Balwyn')
            strictEqual(secondSegment.hours, 2)
            strictEqual(secondSegment.overtime.firstThreeHours, false)
            strictEqual(secondSegment.overtime.afterThreeHours, true)
        })
    })

    describe('Birthday calculations', () => {
        it('should return true when birthday is in range', () => {
            // given
            const birthday = DateTime.fromObject({ day: 2, month: 5, year: 1993 })
            const start = DateTime.fromObject({ day: 20, month: 4, year: 2023 })
            const end = DateTime.fromObject({ day: 5, month: 5, year: 2023 })

            // when
            const result = hasBirthdayDuring(birthday, start, end)

            // then
            strictEqual(result, true)
        })

        it('should return true when birthday is in range - start is birthday', () => {
            // given
            const birthday = DateTime.fromObject({ day: 2, month: 5, year: 1993 })
            const start = DateTime.fromObject({ day: 2, month: 5, year: 2023 })
            const end = DateTime.fromObject({ day: 20, month: 5, year: 2023 })

            // when
            const result = hasBirthdayDuring(birthday, start, end)

            // then
            strictEqual(result, true)
        })

        it('should return true when birthday is in range - end is birthday', () => {
            // given
            const birthday = DateTime.fromObject({ day: 2, month: 5, year: 1993 })
            const start = DateTime.fromObject({ day: 15, month: 4, year: 2023 })
            const end = DateTime.fromObject({ day: 2, month: 5, year: 2023 })

            // when
            const result = hasBirthdayDuring(birthday, start, end)

            // then
            strictEqual(result, true)
        })

        it('should return false when birthday is not range - day before', () => {
            // given
            const birthday = DateTime.fromObject({ day: 2, month: 5, year: 1993 })
            const start = DateTime.fromObject({ day: 20, month: 4, year: 2023 })
            const end = DateTime.fromObject({ day: 1, month: 5, year: 2023 })

            // when
            const result = hasBirthdayDuring(birthday, start, end)

            // then
            strictEqual(result, false)
        })

        it('should return false when birthday is not range - day after', () => {
            // given
            const birthday = DateTime.fromObject({ day: 2, month: 5, year: 1993 })
            const start = DateTime.fromObject({ day: 3, month: 5, year: 2023 })
            const end = DateTime.fromObject({ day: 20, month: 5, year: 2023 })

            // when
            const result = hasBirthdayDuring(birthday, start, end)

            // then
            strictEqual(result, false)
        })

        it('should return false when birthday is not range - day before and after', () => {
            // given
            const birthday = DateTime.fromObject({ day: 2, month: 5, year: 1993 })
            const start = DateTime.fromObject({ day: 3, month: 5, year: 2023 })
            const end = DateTime.fromObject({ day: 1, month: 5, year: 2024 })

            // when
            const result = hasBirthdayDuring(birthday, start, end)

            // then
            strictEqual(result, false)
        })
    })

    describe('Geelong NON-CGS pay items', () => {
        const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
        const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })
        const baseRow = {
            firstName: 'Ryan',
            lastName: 'Saffer',
            hasBirthdayDuringPayrun: false,
            isCasual: true,
            hours: 8,
            summary: '',
            location: 'geelong' as SlingLocation,
        }

        it('maps non-COGS casual Mon-Sat under 18 with low rate to NON-CGS 16&17yo COH - Mon to Sat - Geelong', () => {
            const row = new TimesheetRow({
                ...baseRow,
                dob: youngerThan18,
                date: monday,
                position: SlingPosition.MISCELLANEOUS,
                rate: 14,
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS 16&17yo COH - Mon to Sat - Geelong')
        })

        it('maps non-COGS casual Mon-Sat 18+ to NON-CGS COH - Mon to Sat - Geelong', () => {
            const row = new TimesheetRow({
                ...baseRow,
                dob: olderThan18,
                date: monday,
                position: SlingPosition.MISCELLANEOUS,
                rate: 'not required',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Mon to Sat - Geelong')
        })

        it('maps non-COGS casual Sunday to NON-CGS COH - Sunday - Geelong', () => {
            const row = new TimesheetRow({
                ...baseRow,
                dob: olderThan18,
                date: sunday,
                position: SlingPosition.SUNDAY_MISCELLANEOUS,
                rate: 'not required',
                overtime: { firstThreeHours: false, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS COH - Sunday - Geelong')
        })

        it('maps non-COGS overtime first-3-hours Mon-Sat to NON-CGS OT - First 3 Hrs - Mon to Sat - Geelong', () => {
            const row = new TimesheetRow({
                ...baseRow,
                dob: olderThan18,
                date: monday,
                position: SlingPosition.MISCELLANEOUS,
                rate: 'not required',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Mon to Sat - Geelong')
        })

        it('maps non-COGS overtime first-3-hours Sunday to NON-CGS OT - First 3 Hrs - Sunday - Geelong', () => {
            const row = new TimesheetRow({
                ...baseRow,
                dob: olderThan18,
                date: sunday,
                position: SlingPosition.SUNDAY_MISCELLANEOUS,
                rate: 'not required',
                overtime: { firstThreeHours: true, afterThreeHours: false },
            })
            strictEqual(row.payItem, 'NON-CGS OT - First 3 Hrs - Sunday - Geelong')
        })

        it('maps non-COGS overtime after-3-hours to NON-CGS OT - After 3 Hrs - Geelong', () => {
            const row = new TimesheetRow({
                ...baseRow,
                dob: olderThan18,
                date: monday,
                position: SlingPosition.MISCELLANEOUS,
                rate: 'not required',
                overtime: { firstThreeHours: false, afterThreeHours: true },
            })
            strictEqual(row.payItem, 'NON-CGS OT - After 3 Hrs - Geelong')
        })
    })

    describe('Werribee pay items', () => {
        const monday = DateTime.fromObject({ day: 1, month: 5, year: 2023 })
        const sunday = DateTime.fromObject({ day: 7, month: 5, year: 2023 })
        const baseRow = {
            firstName: 'Ryan',
            lastName: 'Saffer',
            hasBirthdayDuringPayrun: false,
            isCasual: true,
            hours: 8,
            summary: '',
            location: 'werribee' as SlingLocation,
        }
        type RowInput = ConstructorParameters<typeof TimesheetRow>[0]
        const ordinary = { firstThreeHours: false, afterThreeHours: false } as const
        const firstThreeHours = { firstThreeHours: true, afterThreeHours: false } as const
        const afterThreeHours = { firstThreeHours: false, afterThreeHours: true } as const
        const cases: { name: string; overrides: Partial<RowInput>; expected: string }[] = [
            {
                name: 'under-18 COGS ordinary Mon-Sat',
                overrides: { dob: youngerThan18, date: monday, position: SlingPosition.PARTY_FACILITATOR, rate: 14 },
                expected: 'CGS 16&17yo COH - Mon to Sat - Werribee',
            },
            {
                name: 'under-18 non-COGS ordinary Mon-Sat',
                overrides: { dob: youngerThan18, date: monday, position: SlingPosition.MISCELLANEOUS, rate: 14 },
                expected: 'NON-CGS 16&17yo COH - Mon to Sat - Werribee',
            },
            {
                name: 'under-18 supervisor ordinary Mon-Sat',
                overrides: { dob: youngerThan18, date: monday, position: SlingPosition.SUPERVISOR_PARTY, rate: 14 },
                expected: 'SUPERVISOR 16&17yo COH - Mon to Sat - Werribee',
            },
            {
                name: 'adult COGS ordinary Mon-Sat',
                overrides: { dob: olderThan18, date: monday, position: SlingPosition.PARTY_FACILITATOR },
                expected: 'CGS COH - Mon to Sat - Werribee',
            },
            {
                name: 'adult non-COGS ordinary Mon-Sat',
                overrides: { dob: olderThan18, date: monday, position: SlingPosition.MISCELLANEOUS },
                expected: 'NON-CGS COH - Mon to Sat - Werribee',
            },
            {
                name: 'adult supervisor ordinary Mon-Sat',
                overrides: { dob: olderThan18, date: monday, position: SlingPosition.SUPERVISOR_PARTY },
                expected: 'SUPERVISOR COH - Mon to Sat - Werribee',
            },
            {
                name: 'COGS ordinary Sunday',
                overrides: { dob: olderThan18, date: sunday, position: SlingPosition.SUNDAY_PARTY_FACILITATOR },
                expected: 'CGS COH - Sunday - Werribee',
            },
            {
                name: 'non-COGS ordinary Sunday',
                overrides: { dob: olderThan18, date: sunday, position: SlingPosition.SUNDAY_MISCELLANEOUS },
                expected: 'NON-CGS COH - Sunday - Werribee',
            },
            {
                name: 'supervisor ordinary Sunday',
                overrides: { dob: olderThan18, date: sunday, position: SlingPosition.SUNDAY_SUPERVISOR_PARTY },
                expected: 'SUPERVISOR COH - Sunday - Werribee',
            },
            {
                name: 'PT/FT ordinary Mon-Sat',
                overrides: {
                    dob: olderThan18,
                    date: monday,
                    position: SlingPosition.PARTY_FACILITATOR,
                    isCasual: false,
                },
                expected: 'PT/FT Ordinary Hours - Mon to Sat - Werribee',
            },
            {
                name: 'PT/FT ordinary Sunday',
                overrides: {
                    dob: olderThan18,
                    date: sunday,
                    position: SlingPosition.SUNDAY_PARTY_FACILITATOR,
                    isCasual: false,
                },
                expected: 'PT/FT Ordinary Hours - Sunday - Werribee',
            },
            {
                name: 'under-18 on-call Mon-Sat',
                overrides: {
                    dob: youngerThan18,
                    date: monday,
                    position: SlingPosition.ON_CALL_PARTY_FACILITATOR,
                    rate: 14,
                },
                expected: 'On call - 16&17yo Csl Or Hs - Mon to Sat - Werribee',
            },
            {
                name: 'adult on-call Mon-Sat',
                overrides: { dob: olderThan18, date: monday, position: SlingPosition.ON_CALL_PARTY_FACILITATOR },
                expected: 'ON CALL - Cas Ord Hrs - Mon to Sat - Werribee',
            },
            {
                name: 'on-call Sunday',
                overrides: { dob: olderThan18, date: sunday, position: SlingPosition.ON_CALL_PARTY_FACILITATOR },
                expected: 'ON CALL - Cas Ord Hrs - Sunday - Werribee',
            },
            {
                name: 'under-18 called-in Mon-Sat',
                overrides: {
                    dob: youngerThan18,
                    date: monday,
                    position: SlingPosition.CALLED_IN_PARTY_FACILITATOR,
                    rate: 14,
                },
                expected: 'CALLEDIN - 16&17 Cas Ord Hrs - Mon to Sat - Werribee',
            },
            {
                name: 'adult called-in Mon-Sat',
                overrides: { dob: olderThan18, date: monday, position: SlingPosition.CALLED_IN_PARTY_FACILITATOR },
                expected: 'CALLEDIN - Cas Ord Hrs - Mon to Sat - Werribee',
            },
            {
                name: 'called-in Sunday',
                overrides: { dob: olderThan18, date: sunday, position: SlingPosition.CALLED_IN_PARTY_FACILITATOR },
                expected: 'CALLEDIN - Cas Ord Hrs - Sun - Werribee',
            },
            {
                name: 'COGS overtime first three hours Mon-Sat',
                overrides: {
                    dob: olderThan18,
                    date: monday,
                    position: SlingPosition.PARTY_FACILITATOR,
                    overtime: firstThreeHours,
                },
                expected: 'CGS OT - First 3 Hrs - Mon to Sat - Werribee',
            },
            {
                name: 'non-COGS overtime first three hours Mon-Sat',
                overrides: {
                    dob: olderThan18,
                    date: monday,
                    position: SlingPosition.MISCELLANEOUS,
                    overtime: firstThreeHours,
                },
                expected: 'NON-CGS OT - First 3 Hrs - Mon to Sat - Werribee',
            },
            {
                name: 'supervisor overtime first three hours Mon-Sat',
                overrides: {
                    dob: olderThan18,
                    date: monday,
                    position: SlingPosition.SUPERVISOR_PARTY,
                    overtime: firstThreeHours,
                },
                expected: 'SUPERVISOR OT - First 3 Hrs - Mon to Sat - Werribee',
            },
            {
                name: 'COGS overtime first three hours Sunday',
                overrides: {
                    dob: olderThan18,
                    date: sunday,
                    position: SlingPosition.SUNDAY_PARTY_FACILITATOR,
                    overtime: firstThreeHours,
                },
                expected: 'CGS OT - First 3 Hrs - Sunday - Werribee',
            },
            {
                name: 'non-COGS overtime first three hours Sunday',
                overrides: {
                    dob: olderThan18,
                    date: sunday,
                    position: SlingPosition.SUNDAY_MISCELLANEOUS,
                    overtime: firstThreeHours,
                },
                expected: 'NON-CGS OT - First 3 Hrs - Sunday - Werribee',
            },
            {
                name: 'supervisor overtime first three hours Sunday',
                overrides: {
                    dob: olderThan18,
                    date: sunday,
                    position: SlingPosition.SUNDAY_SUPERVISOR_PARTY,
                    overtime: firstThreeHours,
                },
                expected: 'SUPERVISOR OT - First 3 Hrs - Sunday - Werribee',
            },
            {
                name: 'COGS overtime after three hours',
                overrides: {
                    dob: olderThan18,
                    date: monday,
                    position: SlingPosition.PARTY_FACILITATOR,
                    overtime: afterThreeHours,
                },
                expected: 'CGS OT - After 3 Hrs - Werribee',
            },
            {
                name: 'non-COGS overtime after three hours',
                overrides: {
                    dob: olderThan18,
                    date: monday,
                    position: SlingPosition.MISCELLANEOUS,
                    overtime: afterThreeHours,
                },
                expected: 'NON-CGS OT - After 3 Hrs - Werribee',
            },
            {
                name: 'supervisor overtime after three hours',
                overrides: {
                    dob: olderThan18,
                    date: monday,
                    position: SlingPosition.SUPERVISOR_PARTY,
                    overtime: afterThreeHours,
                },
                expected: 'SUPERVISOR OT - After 3 Hrs - Werribee',
            },
        ]

        for (const testCase of cases) {
            it(`maps ${testCase.name}`, () => {
                const row = new TimesheetRow({
                    ...baseRow,
                    dob: olderThan18,
                    date: monday,
                    position: SlingPosition.PARTY_FACILITATOR,
                    rate: 'not required',
                    overtime: ordinary,
                    ...testCase.overrides,
                })

                strictEqual(row.payItem, testCase.expected)
            })
        }
    })

    describe('Laundry allowance', () => {
        const FIRST_NAME = 'Ryan'
        const LAST_NAME = 'Saffer'
        const TZ = 'Australia/Melbourne'

        // Helper to keep the fixtures terse. Defaults to balwyn + party
        // facilitator (an eligible shift) so each test only specifies what it
        // wants to vary.
        const shift = (overrides: {
            dtstart: string
            dtend?: string
            locationId?: number
            positionId?: number
            userId?: number
            summary?: string
        }): Timesheet => ({
            dtstart: overrides.dtstart,
            dtend: overrides.dtend ?? overrides.dtstart,
            location: { id: overrides.locationId ?? SlingLocationToId.balwyn },
            position: { id: overrides.positionId ?? SlingPositionToId[SlingPosition.PARTY_FACILITATOR] },
            user: { id: overrides.userId ?? 1 },
            status: 'published',
            summary: overrides.summary ?? '',
        })

        const run = (timesheets: Timesheet[]) =>
            createLaundryAllowanceRows({
                firstName: FIRST_NAME,
                lastName: LAST_NAME,
                usersTimesheets: timesheets,
                timezone: TZ,
            })

        describe('isLaundryEligibleShift', () => {
            // Every position the function knows about, with its expected
            // eligibility. If a new position is added to the enum without a
            // case in the switch, this object's typing will catch the omission
            // *and* `default` will throw at runtime.
            const expectations: Record<SlingPosition, boolean> = {
                // Mon - Sat facilitator shifts (eligible)
                [SlingPosition.PARTY_FACILITATOR]: true,
                [SlingPosition.MOBILE_PARTY_FACILITATOR]: true,
                [SlingPosition.AFTER_SCHOOL_PROGRAM_FACILITATOR]: true,
                [SlingPosition.HOLIDAY_PROGRAM_FACILITATOR]: true,
                [SlingPosition.PLAY_LAB_FACILITATOR]: true,
                [SlingPosition.EVENTS_AND_ACTIVATIONS]: true,
                [SlingPosition.INCURSIONS]: true,
                // Sunday facilitator shifts (eligible)
                [SlingPosition.SUNDAY_PARTY_FACILITATOR]: true,
                [SlingPosition.SUNDAY_MOBILE_PARTY_FACILITATOR]: true,
                [SlingPosition.SUNDAY_AFTER_SCHOOL_FACILITATOR]: true,
                [SlingPosition.SUNDAY_HOLIDAY_PROGRAM_FACILITATOR]: true,
                [SlingPosition.SUNDAY_PLAY_LAB_FACILITATOR]: true,
                [SlingPosition.SUNDAY_EVENTS_AND_ACTIVATIONS]: true,
                [SlingPosition.SUNDAY_INCURSIONS]: true,
                // Called-in facilitator shifts (eligible; slated for removal)
                [SlingPosition.CALLED_IN_PARTY_FACILITATOR]: true,
                [SlingPosition.CALLED_IN_MOBILE_PARTY_FACILITATOR]: true,
                [SlingPosition.CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR]: true,
                [SlingPosition.CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR]: true,
                [SlingPosition.CALLED_IN_PLAY_LAB_FACILITATOR]: true,
                [SlingPosition.CALLED_IN_EVENTS_AND_ACTIVATIONS]: true,
                [SlingPosition.CALLED_IN_INCURSIONS]: true,
                [SlingPosition.SUNDAY_CALLED_IN_PARTY_FACILITATOR]: true,
                [SlingPosition.SUNDAY_CALLED_IN_MOBILE_PARTY_FACILITATOR]: true,
                [SlingPosition.SUNDAY_CALLED_IN_AFTER_SCHOOL_PROGRAM_FACILITATOR]: true,
                [SlingPosition.SUNDAY_CALLED_IN_HOLIDAY_PROGRAM_FACILITATOR]: true,
                [SlingPosition.SUNDAY_CALLED_IN_PLAY_LAB_FACILITATOR]: true,
                [SlingPosition.SUNDAY_CALLED_IN_EVENTS_AND_ACTIVATIONS]: true,
                [SlingPosition.SUNDAY_CALLED_IN_INCURSIONS]: true,
                // On call (ineligible)
                [SlingPosition.ON_CALL_PARTY_FACILITATOR]: false,
                [SlingPosition.ON_CALL_MOBILE_PARTY_FACILITATOR]: false,
                [SlingPosition.ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR]: false,
                [SlingPosition.ON_CALL_HOLIDAY_PROGRAM_FACILITATOR]: false,
                [SlingPosition.ON_CALL_PLAY_LAB_FACILITATOR]: false,
                [SlingPosition.ON_CALL_EVENTS_AND_ACTIVATIONS]: false,
                [SlingPosition.ON_CALL_INCURSIONS]: false,
                [SlingPosition.SUNDAY_ON_CALL_PARTY_FACILITATOR]: false,
                [SlingPosition.SUNDAY_ON_CALL_MOBILE_PARTY_FACILITATOR]: false,
                [SlingPosition.SUNDAY_ON_CALL_AFTER_SCHOOL_PROGRAM_FACILITATOR]: false,
                [SlingPosition.SUNDAY_ON_CALL_HOLIDAY_PROGRAM_FACILITATOR]: false,
                [SlingPosition.SUNDAY_ON_CALL_PLAY_LAB_FACILITATOR]: false,
                [SlingPosition.SUNDAY_ON_CALL_EVENTS_AND_ACTIVATIONS]: false,
                [SlingPosition.SUNDAY_ON_CALL_INCURSIONS]: false,
                [SlingPosition.PIC]: false,
                [SlingPosition.SUNDAY_PIC]: false,
                // Supervisor (ineligible)
                [SlingPosition.SUPERVISOR_PARTY]: false,
                [SlingPosition.SUNDAY_SUPERVISOR_PARTY]: false,
                [SlingPosition.SUPERVISOR_MOBILE_PARTY]: false,
                [SlingPosition.SUNDAY_SUPERVISOR_MOBILE_PARTY]: false,
                [SlingPosition.SUPERVISOR_AFTER_SCHOOL_PROGRAM]: false,
                [SlingPosition.SUNDAY_SUPERVISOR_AFTER_SCHOOL_PROGRAM]: false,
                [SlingPosition.SUPERVISOR_EVENTS_AND_ACTIVATIONS]: false,
                [SlingPosition.SUNDAY_SUPERVISOR_EVENTS_AND_ACTIVATIONS]: false,
                [SlingPosition.SUPERVISOR_HOLIDAY_PROGRAM]: false,
                [SlingPosition.SUNDAY_SUPERVISOR_HOLIDAY_PROGRAM]: false,
                [SlingPosition.SUPERVISOR_INCURSIONS]: false,
                [SlingPosition.SUNDAY_SUPERVISOR_INCURSIONS]: false,
                [SlingPosition.SUPERVISOR_PLAY_LAB]: false,
                [SlingPosition.SUNDAY_SUPERVISOR_PLAY_LAB]: false,
                // Training / Miscellaneous (ineligible)
                [SlingPosition.TRAINING]: false,
                [SlingPosition.SUNDAY_TRAINING]: false,
                [SlingPosition.MISCELLANEOUS]: false,
                [SlingPosition.SUNDAY_MISCELLANEOUS]: false,
            }

            // Sanity check: every enum member must be present in `expectations`
            // so this suite stays exhaustive as positions are added.
            it('covers every SlingPosition value', () => {
                const enumValues = Object.values(SlingPosition)
                const expected = Object.keys(expectations)
                strictEqual(enumValues.length, expected.length)
                for (const value of enumValues) {
                    strictEqual(
                        Object.prototype.hasOwnProperty.call(expectations, value),
                        true,
                        `missing expectation for ${value}`
                    )
                }
            })

            for (const [position, expected] of Object.entries(expectations) as Array<[SlingPosition, boolean]>) {
                it(`${expected ? 'includes' : 'excludes'} ${position}`, () => {
                    strictEqual(isLaundryEligibleShift(position), expected)
                })
            }

            it('throws on unrecognised position', () => {
                const invalid = 'NOT_A_REAL_POSITION' as SlingPosition
                throws(
                    () => isLaundryEligibleShift(invalid),
                    /Unhandled position while determining isLaundryEligibleShift/
                )
            })
        })

        describe('getLaundryAllowancePayItem', () => {
            const cases: Array<[SlingLocation, string]> = [
                ['balwyn', 'Laundry Allowance - Balwyn'],
                ['cheltenham', 'Laundry Allowance - Cheltenham'],
                ['essendon', 'Laundry Allowance - Essendon'],
                ['geelong', 'Laundry Allowance - Geelong'],
                ['kingsville', 'Laundry Allowance - Kingsville'],
                ['malvern', 'Laundry Allowance - Malvern'],
                ['werribee', 'Laundry Allowance - Werribee'],
                ['head-office', 'Laundry Allowance - Head Office'],
            ]

            for (const [location, payItem] of cases) {
                it(`maps ${location} to '${payItem}'`, () => {
                    strictEqual(getLaundryAllowancePayItem(location), payItem)
                })
            }
        })

        describe('LaundryAllowanceRow', () => {
            it('exposes the CSV-writable shape used by the timesheets writer', () => {
                const date = DateTime.fromObject({ year: 2024, month: 6, day: 3 }, { zone: TZ })
                const row = new LaundryAllowanceRow({
                    firstName: 'Ryan',
                    lastName: 'Saffer',
                    date,
                    hours: 1,
                    location: 'balwyn',
                    activity: 'Parties',
                    summary: 'Laundry allowance',
                })
                strictEqual(row.firstName, 'Ryan')
                strictEqual(row.lastname, 'Saffer')
                strictEqual(row.date, date)
                strictEqual(row.hours, 1)
                strictEqual(row.payItem, 'Laundry Allowance - Balwyn')
                strictEqual(row.activity, 'Parties')
                strictEqual(row.summary, 'Laundry allowance')
            })

            it('preserves fractional hours for top-up rows', () => {
                const row = new LaundryAllowanceRow({
                    firstName: FIRST_NAME,
                    lastName: LAST_NAME,
                    date: DateTime.fromObject({ year: 2024, month: 6, day: 8 }, { zone: TZ }),
                    hours: 0.0152,
                    location: 'cheltenham',
                    activity: 'No Activity',
                    summary: 'Laundry allowance (weekly cap top-up)',
                })
                strictEqual(row.hours, 0.0152)
                strictEqual(row.payItem, 'Laundry Allowance - Cheltenham')
            })
        })

        describe('constants', () => {
            it('match the award amounts and full-day allotment', () => {
                strictEqual(LAUNDRY_DAILY_RATE, 1.32)
                strictEqual(LAUNDRY_WEEKLY_CAP, 6.62)
                strictEqual(LAUNDRY_FULL_DAYS_PER_WEEK, 5)
            })
        })

        describe('createLaundryAllowanceRows', () => {
            it('returns no rows when the user has no timesheets', () => {
                const rows = run([])
                strictEqual(rows.length, 0)
            })

            it('returns no rows when every shift is ineligible', () => {
                const rows = run([
                    shift({
                        dtstart: '2024-06-03T10:00:00+10:00',
                        dtend: '2024-06-03T14:00:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.SUPERVISOR_PARTY],
                    }),
                    shift({
                        dtstart: '2024-06-04T10:00:00+10:00',
                        dtend: '2024-06-04T14:00:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.ON_CALL_PARTY_FACILITATOR],
                    }),
                    shift({
                        dtstart: '2024-06-05T10:00:00+10:00',
                        dtend: '2024-06-05T14:00:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.TRAINING],
                    }),
                ])
                strictEqual(rows.length, 0)
            })

            it('skips shifts whose position id is unknown', () => {
                const rows = run([
                    shift({
                        dtstart: '2024-06-03T10:00:00+10:00',
                        dtend: '2024-06-03T14:00:00+10:00',
                        positionId: 99999999, // not in SlingPositionMap
                    }),
                ])
                strictEqual(rows.length, 0)
            })

            it('skips shifts whose location id is unknown', () => {
                const rows = run([
                    shift({
                        dtstart: '2024-06-03T10:00:00+10:00',
                        dtend: '2024-06-03T14:00:00+10:00',
                        locationId: 99999999, // not in SlingLocationsMap
                    }),
                ])
                strictEqual(rows.length, 0)
            })

            it('skips shifts with an unparseable dtstart', () => {
                const rows = run([
                    shift({
                        dtstart: 'not-a-date',
                        dtend: 'not-a-date',
                    }),
                ])
                strictEqual(rows.length, 0)
            })

            it('emits one row per eligible day with hours=1 and inherits the shifts activity/location', () => {
                const rows = run([
                    shift({
                        dtstart: '2024-06-03T10:00:00+10:00',
                        dtend: '2024-06-03T14:00:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.HOLIDAY_PROGRAM_FACILITATOR],
                        locationId: SlingLocationToId.cheltenham,
                    }),
                ])
                strictEqual(rows.length, 1)
                strictEqual(rows[0].hours, 1)
                strictEqual(rows[0].firstName, FIRST_NAME)
                strictEqual(rows[0].lastname, LAST_NAME)
                strictEqual(rows[0].payItem, 'Laundry Allowance - Cheltenham')
                strictEqual(rows[0].activity, 'Holiday Programs')
                strictEqual(rows[0].date.toISODate(), '2024-06-03')
                strictEqual(rows[0].summary, 'Laundry allowance')
            })

            it('counts a day with multiple eligible shifts only once and uses the earliest shift for activity/location', () => {
                const rows = run([
                    // later in the day - holiday program at cheltenham
                    shift({
                        dtstart: '2024-06-03T14:00:00+10:00',
                        dtend: '2024-06-03T18:00:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.HOLIDAY_PROGRAM_FACILITATOR],
                        locationId: SlingLocationToId.cheltenham,
                    }),
                    // earliest - party at balwyn
                    shift({
                        dtstart: '2024-06-03T09:00:00+10:00',
                        dtend: '2024-06-03T11:00:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.PARTY_FACILITATOR],
                        locationId: SlingLocationToId.balwyn,
                    }),
                    // mid-day - same shift type already exists for the day
                    shift({
                        dtstart: '2024-06-03T11:30:00+10:00',
                        dtend: '2024-06-03T13:30:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.PARTY_FACILITATOR],
                        locationId: SlingLocationToId.balwyn,
                    }),
                ])
                strictEqual(rows.length, 1)
                strictEqual(rows[0].payItem, 'Laundry Allowance - Balwyn')
                strictEqual(rows[0].activity, 'Parties')
            })

            it('still counts a day as eligible when ineligible shifts share that day', () => {
                const rows = run([
                    // ineligible
                    shift({
                        dtstart: '2024-06-03T08:00:00+10:00',
                        dtend: '2024-06-03T09:00:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.SUPERVISOR_PARTY],
                    }),
                    // eligible
                    shift({
                        dtstart: '2024-06-03T12:00:00+10:00',
                        dtend: '2024-06-03T16:00:00+10:00',
                        positionId: SlingPositionToId[SlingPosition.PARTY_FACILITATOR],
                    }),
                ])
                strictEqual(rows.length, 1)
                strictEqual(rows[0].hours, 1)
                strictEqual(rows[0].activity, 'Parties')
            })

            it('emits rows for 5 eligible days with no top-up row', () => {
                const days = ['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07']
                const rows = run(
                    days.map((day) =>
                        shift({
                            dtstart: `${day}T10:00:00+10:00`,
                            dtend: `${day}T14:00:00+10:00`,
                        })
                    )
                )
                strictEqual(rows.length, 5)
                for (let i = 0; i < days.length; i++) {
                    strictEqual(rows[i].date.toISODate(), days[i])
                    strictEqual(rows[i].hours, 1)
                    strictEqual(rows[i].summary, 'Laundry allowance')
                }
                const total = rows.reduce((sum, row) => sum + row.hours * LAUNDRY_DAILY_RATE, 0)
                // 5 * 1.32 = 6.60
                strictEqual(Number(total.toFixed(2)), 6.6)
            })

            it('caps a week of 6 eligible days at the dollar cap with a fractional top-up row', () => {
                const days = ['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07', '2024-06-08']
                const rows = run(
                    days.map((day, idx) =>
                        shift({
                            dtstart: `${day}T10:00:00+10:00`,
                            dtend: `${day}T14:00:00+10:00`,
                            // give the 6th day a distinct location/activity to
                            // prove the top-up row inherits from that day.
                            positionId:
                                idx === 5
                                    ? SlingPositionToId[SlingPosition.HOLIDAY_PROGRAM_FACILITATOR]
                                    : SlingPositionToId[SlingPosition.PARTY_FACILITATOR],
                            locationId: idx === 5 ? SlingLocationToId.cheltenham : SlingLocationToId.balwyn,
                        })
                    )
                )

                strictEqual(rows.length, 6)

                // First 5 rows are the full-day rows.
                for (let i = 0; i < 5; i++) {
                    strictEqual(rows[i].hours, 1)
                    strictEqual(rows[i].payItem, 'Laundry Allowance - Balwyn')
                    strictEqual(rows[i].activity, 'Parties')
                    strictEqual(rows[i].summary, 'Laundry allowance')
                    strictEqual(rows[i].date.toISODate(), days[i])
                }

                // 6th row is the top-up.
                const topUp = rows[5]
                strictEqual(topUp.hours, 0.0152) // (6.62 - 6.60) / 1.32, rounded to 4dp
                strictEqual(topUp.payItem, 'Laundry Allowance - Cheltenham')
                strictEqual(topUp.activity, 'Holiday Programs')
                strictEqual(topUp.summary, 'Laundry allowance (weekly cap top-up)')
                strictEqual(topUp.date.toISODate(), '2024-06-08')

                // Total payout (Xero rounds units * rate to 2dp).
                const total = rows.reduce((sum, row) => sum + row.hours * LAUNDRY_DAILY_RATE, 0)
                strictEqual(Number(total.toFixed(2)), LAUNDRY_WEEKLY_CAP)
            })

            it('does not emit any further rows for the 7th eligible day onwards', () => {
                const days = [
                    '2024-06-03',
                    '2024-06-04',
                    '2024-06-05',
                    '2024-06-06',
                    '2024-06-07',
                    '2024-06-08',
                    '2024-06-09',
                ]
                const rows = run(
                    days.map((day) =>
                        shift({
                            dtstart: `${day}T10:00:00+10:00`,
                            dtend: `${day}T14:00:00+10:00`,
                        })
                    )
                )
                // Still only 6 rows (5 full + 1 top-up).
                strictEqual(rows.length, 6)
                // None of the rows reference the 7th day.
                strictEqual(
                    rows.some((row) => row.date.toISODate() === '2024-06-09'),
                    false
                )
            })

            it('emits rows in chronological order regardless of the input order', () => {
                // Input order is intentionally jumbled.
                const rows = run([
                    shift({
                        dtstart: '2024-06-07T10:00:00+10:00',
                        dtend: '2024-06-07T14:00:00+10:00',
                    }),
                    shift({
                        dtstart: '2024-06-03T10:00:00+10:00',
                        dtend: '2024-06-03T14:00:00+10:00',
                    }),
                    shift({
                        dtstart: '2024-06-05T10:00:00+10:00',
                        dtend: '2024-06-05T14:00:00+10:00',
                    }),
                ])
                strictEqual(rows.length, 3)
                strictEqual(rows[0].date.toISODate(), '2024-06-03')
                strictEqual(rows[1].date.toISODate(), '2024-06-05')
                strictEqual(rows[2].date.toISODate(), '2024-06-07')
            })

            it('groups by calendar day in the user timezone', () => {
                // Two shifts on the same Melbourne calendar day even though
                // their UTC timestamps cross midnight.
                const rows = run([
                    // 2024-06-03 23:30 AEST -> still 2024-06-03 local
                    shift({
                        dtstart: '2024-06-03T23:30:00+10:00',
                        dtend: '2024-06-03T23:59:00+10:00',
                    }),
                    // 2024-06-03 21:00 UTC == 2024-06-04 07:00 AEST -> 2024-06-04 local
                    shift({
                        dtstart: '2024-06-03T21:00:00Z',
                        dtend: '2024-06-03T22:00:00Z',
                    }),
                ])
                strictEqual(rows.length, 2)
                strictEqual(rows[0].date.toISODate(), '2024-06-03')
                strictEqual(rows[1].date.toISODate(), '2024-06-04')
            })
        })
    })
})
