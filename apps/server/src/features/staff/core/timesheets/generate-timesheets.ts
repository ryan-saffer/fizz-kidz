import { randomUUID } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { logger } from 'firebase-functions/v2'
import { DateTime } from 'luxon'

import {
    isFranchise,
    isNotNull,
    type FranchiseOrMaster,
    type GenerateTimesheetsParams,
    type ShiftUnderMinimumShiftLength,
} from '@fizz-kidz/core'

import { didTurn18DuringRange, getEmployeesWithBirthdayDuringRange, isCasualEmployee } from '../staff-birthdays'
import { getShiftsUnderMinimumShiftLengthForTimesheets } from './minimum-shift-length-report'
import {
    createTimesheetRows,
    getWeeks,
    isYoungerThan18,
    SlingLocationsMap,
    createLaundryAllowanceRows,
} from './timesheets.utils'

import type { Rate } from './timesheets.types'
import type { LaundryAllowanceRow, TimesheetRow } from './timesheets.utils'
import type { Employee } from 'xero-node/dist/gen/model/payroll-au/employee'

import { projectId } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { StorageClient } from '@/integrations/firebase/storage.client'
import { SlingClient } from '@/integrations/sling/sling.client'
import { XeroClient } from '@/integrations/xero/xero.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

const OVERTIME_START = 38

type XeroUserCache = { [key: string]: Employee | undefined }

export const OrdindayEarningsRateMap: Record<FranchiseOrMaster, string> = {
    master: '1ef5805a-5208-4d89-8f35-620104543ed4',
    balwyn: '5c60fbcc-9afa-4f93-a7c8-53a9a0bca39a',
    kingsville: '45fbb097-d95f-40d3-ae55-5ba650b79b1f',
    werribee: '8ba18b75-4e4f-4ed0-8c34-f5be6bea0b69',
}

export async function generateTimesheets({ startDateInput, endDateInput, studio }: GenerateTimesheetsParams) {
    const slingClient = new SlingClient()

    // ensure dates start and end at midnight
    const startDate = DateTime.fromFormat(startDateInput, 'dd/MM/yyyy').set({
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    })
    const endDate = DateTime.fromFormat(endDateInput, 'dd/MM/yyyy').set({
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    })

    // validate data
    if (startDate > endDate) {
        throwTrpcError('BAD_REQUEST', 'start date must come before the end date', {
            errorCode: 'invalid-range',
        })
    }

    const diffInDays = endDate.diff(startDate, 'days').days
    if (diffInDays > 28) {
        throwTrpcError('BAD_REQUEST', 'date range must be 28 days or less', {
            errorCode: 'invalid-length',
        })
    }

    try {
        // break the time period into weeks
        const weeks = getWeeks(startDate, endDate)

        // get all sling users
        const slingUsers = await slingClient.getUsers()

        // cache for xero users
        const xeroUsersCache: XeroUserCache = {}

        const xeroUsers = await getAllXeroEmployees(studio)

        // all employees who had a birthday during the pay run
        const birthdayCandidates = getEmployeesWithBirthdayDuringRange({
            employees: xeroUsers,
            studio,
            start: startDate,
            end: endDate,
        })
        const employeesWithBirthdayDuringPayrun = (
            await Promise.all(
                birthdayCandidates.map(async (employee) => {
                    const fullEmployee = await getAndCacheXeroUser(employee.employeeId, xeroUsersCache, studio)
                    return isCasualEmployee(fullEmployee) ? employee : null
                })
            )
        ).filter(isNotNull)

        const employeesWithBirthdayDuringPayrunMap = new Map(
            employeesWithBirthdayDuringPayrun.map((employee) => [employee.employeeId, employee])
        )

        const employeesWithBirthdayWhoWorkedSet = new Set<string>()

        // to keep track of all rows
        let rows: Array<TimesheetRow | LaundryAllowanceRow> = []

        // keeps track of users who couldnt be found in xero
        const skippedUsers: string[] = []

        // keeps track of users who have a birthday during the pay period
        const employeesWithBirthdayWhoWorked: string[] = []

        // keeps track of users who are under 18, but worked for more than 30 hrs in a single week (in order to be paid super)
        const employeesUnder18Over30Hrs: string[] = []

        // keeps track of shifts shorter than the payroll minimum by day
        const shiftsUnderMinimumShiftLength: ShiftUnderMinimumShiftLength[] = []

        // calculate timesheets one week at a time
        for (const week of weeks) {
            // get all shifts for the time period
            const allTimesheets = await slingClient.getTimesheets(week.start.toJSDate(), week.end.toJSDate())
            shiftsUnderMinimumShiftLength.push(
                ...getShiftsUnderMinimumShiftLengthForTimesheets({
                    studio,
                    slingUsers,
                    allTimesheets,
                })
            )
            const timesheets = allTimesheets
                .filter((it) => it.status === 'published')
                .filter((it) => {
                    // depending on the franchise, filter out the location
                    const slingLocation = SlingLocationsMap[it.location.id]
                    if (studio === 'master') {
                        if (slingLocation === 'head-office') return true
                        return !isFranchise(slingLocation)
                    }
                    return slingLocation === studio
                })

            // for each user, get all their timesheets
            for (const slingUser of slingUsers) {
                const usersTimesheets = timesheets.filter((it) => it.user.id === slingUser.id)
                if (usersTimesheets.length === 0) continue

                let xeroUser = xeroUsers?.find(
                    (user) =>
                        user.email?.toLowerCase() === slingUser.email.toLowerCase() ||
                        user.email?.toLowerCase() === slingUser.pending?.toLowerCase()
                )
                if (!xeroUser) {
                    logger.log(`unable to find sling user in Xero: ${slingUser.legalName} ${slingUser.lastname}`)
                    skippedUsers.push(`${slingUser.legalName} ${slingUser.lastname}`)
                    continue
                }

                const dob = DateTime.fromJSDate(new Date(xeroUser.dateOfBirth))
                const hasBirthdayDuringPayrun = Boolean(
                    xeroUser.employeeID && employeesWithBirthdayDuringPayrunMap.has(xeroUser.employeeID)
                )
                if (hasBirthdayDuringPayrun) {
                    employeesWithBirthdayWhoWorkedSet.add(xeroUser.employeeID!)
                    employeesWithBirthdayWhoWorked.push(
                        formatBirthdayEmployeeLabel({
                            fullName: `${xeroUser.firstName} ${xeroUser.lastName}`,
                            dob,
                            start: startDate,
                            end: endDate,
                        })
                    )
                }

                // if the employee is under 18, fetch their pay template.
                // this will help determine if they are already above the minimum $18/hr rate.
                // only fetch under 18 year olds because this call is expensive.
                let rate: Rate = 'not required'
                if (isYoungerThan18(dob)) {
                    xeroUser = await getAndCacheXeroUser(xeroUser.employeeID!, xeroUsersCache, studio)
                    const ordinaryRate = xeroUser.payTemplate?.earningsLines?.find(
                        (line) => line.earningsRateID === OrdindayEarningsRateMap[studio]
                    )?.ratePerUnit
                    if (!ordinaryRate) {
                        logger.log(
                            `unable to find ordinary earnings rate in Xero for user: ${slingUser.legalName} ${slingUser.lastname}`
                        )
                        skippedUsers.push(`${slingUser.legalName} ${slingUser.lastname}`)
                        continue
                    }
                    rate = ordinaryRate
                }

                const { rows: employeesRows, totalHours } = createTimesheetRows({
                    firstName: xeroUser.firstName,
                    lastName: xeroUser.lastName,
                    dob,
                    hasBirthdayDuringPayrun,
                    isCasual: true,
                    overtimeThreshold: OVERTIME_START,
                    usersTimesheets,
                    rate,
                    timezone: slingUser.timezone,
                })

                if (isYoungerThan18(dob) && totalHours > 30) {
                    employeesUnder18Over30Hrs.push(`${xeroUser.firstName} ${xeroUser.lastName}`)
                }

                // laundry allowance: one row per eligible day in this week
                // (capped at the weekly maximum). Eligibility is determined by
                // shift position; see `isLaundryEligibleShift`.
                const laundryRows = createLaundryAllowanceRows({
                    firstName: xeroUser.firstName!,
                    lastName: xeroUser.lastName!,
                    usersTimesheets,
                    timezone: slingUser.timezone,
                })

                rows = [...rows, ...employeesRows, ...laundryRows]
            }
        }

        // create the csv
        const filename = `${startDate.toLocaleString(DateTime.DATE_SHORT)}:${endDate.toLocaleString(
            DateTime.DATE_SHORT
        )}.csv`
            .split('/')
            .join('-')
        const tempFilePath = path.join(os.tmpdir(), filename)

        fs.writeFileSync(tempFilePath, 'first_name,last_name,type,tracking_code,date,hours,notes\n')
        rows.map((row) =>
            fs.appendFileSync(
                tempFilePath,
                `${row.firstName},${row.lastname},${row.payItem},${row.activity},${row.date.toLocaleString(
                    DateTime.DATE_SHORT
                )},${row.hours},${row.summary.replace(/[\r\n]+/gm, '')}\n`
            )
        )

        const storage = await StorageClient.getInstance()
        const bucketName = `${projectId}.appspot.com`
        const destination = `payroll/${filename}`

        // if running locally, signing a url isn't possible, so use a download token instead
        const downloadToken = isUsingEmulator() ? randomUUID() : null

        const [file] = await storage.bucket(bucketName).upload(tempFilePath, {
            destination,
            ...(downloadToken
                ? {
                      metadata: {
                          metadata: {
                              firebaseStorageDownloadTokens: downloadToken,
                          },
                      },
                  }
                : {}),
        })

        let downloadUrl: string
        if (downloadToken) {
            // running locally
            downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
                destination
            )}?alt=media&token=${downloadToken}`
        } else {
            const url = await file.getSignedUrl({
                action: 'read',
                expires: DateTime.now().plus({ days: 7 }).toISODate(),
            })
            downloadUrl = url[0]
        }

        // remove duplicate skipped users
        return {
            url: downloadUrl,
            skippedEmployees: [...new Set(skippedUsers)],
            employeesWithBirthdayWhoWorked: [...new Set(employeesWithBirthdayWhoWorked)],
            employeesWithBirthdayWhoDidNotWork: employeesWithBirthdayDuringPayrun
                .filter((employee) => !employeesWithBirthdayWhoWorkedSet.has(employee.employeeId))
                .map((employee) =>
                    formatBirthdayEmployeeLabel({
                        fullName: employee.fullName,
                        dob: employee.dob,
                        start: startDate,
                        end: endDate,
                    })
                ),
            employeesUnder18Over30Hrs: [...new Set(employeesUnder18Over30Hrs)],
            shiftsUnderMinimumShiftLength,
        }
    } catch (err) {
        throwTrpcError('INTERNAL_SERVER_ERROR', 'error generating timesheets', err)
    }
}

async function getAndCacheXeroUser(userId: string, cache: XeroUserCache, studio: FranchiseOrMaster) {
    const cachedUser = cache[userId]
    if (cachedUser) return cachedUser

    const xero = await XeroClient.getInstance(studio)
    // oxlint-disable-next-line typescript/no-non-null-asserted-optional-chain
    const employee = (await xero.payrollAUApi.getEmployee('', userId)).body.employees?.[0]!
    cache[userId] = employee
    return employee
}

export async function getAllXeroEmployees(studio: FranchiseOrMaster) {
    const xero = await XeroClient.getInstance(studio)
    const employees: Employee[] = []
    let page = 1
    let hasMorePages = true

    while (hasMorePages) {
        const pageEmployees = (await xero.payrollAUApi.getEmployees('', undefined, undefined, undefined, page)).body
            .employees

        if (!pageEmployees?.length) {
            hasMorePages = false
            continue
        }

        employees.push(...pageEmployees)

        if (pageEmployees.length < 100) {
            hasMorePages = false
        }
        page++
    }

    return employees
}

function formatBirthdayEmployeeLabel({
    fullName,
    dob,
    start,
    end,
}: {
    fullName: string
    dob: DateTime
    start: DateTime
    end: DateTime
}) {
    const turned18DuringPayPeriod = didTurn18DuringRange(dob, start, end)
    const prefix = turned18DuringPayPeriod ? '[⚠️ Turned 18] ' : ''

    return `${prefix}${fullName} - ${dob.toLocaleString(DateTime.DATE_SHORT)}`
}
