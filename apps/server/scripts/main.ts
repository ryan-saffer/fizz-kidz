import '@/app/init/load-env'
import { DateTime } from 'luxon'
import prompts from 'prompts'

import { AcuityConstants, AcuityUtilities, STUDIOS } from '@fizz-kidz/core'

import { getAfterSchoolProgramAnaphylaxisPlanSignedUrl } from './after-school-program/get-after-school-program-anaphylaxis-plan-signed-url'
import { getAllUsers } from './auth/get-all-users'
import { deleteEvents } from './events/delete-events'
import { importGoogleReviewsToMixpanel } from './google-business-profile/import-google-reviews-to-mixpanel'
import {
    migrateScienceEnrolments,
    migration_addChildSupportToAllExistingEnrolments,
} from './migrations/after-school-program'
import { deleteFromLegacy, groupEventsByContactEmail, migrateLegacyEvents } from './migrations/events'
import { addFoodPackageToAllParties } from './migrations/parties-self-catering'
import { getSelfCateredPartiesByNotes } from './parties/get-self-catered-parties-by-notes'
import { updatePartiesToOldPrices } from './parties/update-parties-to-old-prices'
import { runRemovePreschoolProgramClassScript } from './preschool-program/remove-preschool-program-class'
import { getEvents } from './reports/get-events'
import { getHolidayPrograms } from './reports/get-holiday-programs'
import { getParties } from './reports/get-parties'
import { restoreHolidayProgramContactPhones } from './zoho/restore-holiday-program-contact-phones'

import type { Square } from 'square'

import { cleanUpStaleInvitations } from '@/features/party-bookings/core/rsvp/clean-up-stale-invitations'
import { updateSlingWages } from '@/features/staff/core/payroll/update-sling-wages'
import { sendMinimumShiftLengthReport } from '@/features/staff/core/send-minimum-shift-length-report'
import { SquareClient } from '@/integrations/square/square.client'
;(async () => {
    const { script } = await prompts({
        type: 'select',
        name: 'script',
        message: 'Select script to run',
        choices: [
            {
                title: 'Holiday Program Bookings',
                value: 'runHolidayProgramsReport',
            },
            {
                title: 'Clear stale invitations',
                value: 'clearStaleInvitations',
            },
            {
                title: 'Send minimum shift length report',
                description: 'Sends real report emails to master and franchise recipients',
                value: 'sendMinimumShiftLengthReport',
            },
            {
                title: 'Run report on bookings',
                value: 'runBookingsReport',
            },
            {
                title: 'Get party bookings',
                value: 'getParties',
            },
            {
                title: 'Delete Events By Email',
                value: 'deleteEventsByEmail',
            },
            {
                title: 'List all users',
                value: 'listAllUsers',
            },
            {
                title: 'Update Sling Wages',
                value: 'updateSlingWages',
            },
            {
                title: 'Update all bookings to old prices',
                value: 'updatePartiesToOldPrices',
            },
            { title: 'Sign after school program anaphylaxis plan', value: 'signAnaphylaxisPlan' },
            {
                title: 'Group legacy events by contact email',
                description: 'Creates a json file that groups all legacy events',
                value: 'legacyEventsGrouping',
            },
            {
                title: 'Delete legacy events from calendar',
                value: 'deleteLegacyCalendarEvents',
            },
            {
                title: 'Migrate legacy events to new events',
                value: 'migrateLegacyEvents',
            },
            {
                title: 'Migrate science enrolments',
                description: 'Moves scienceAppointments to afterSchoolEnrolments',
                value: 'migrateScienceEnrolments',
            },
            {
                title: 'Add child support to all existing after school enrolments',
                value: 'addChildSupportToExistingEnrolments',
            },
            {
                title: 'Add food package to all parties',
                value: 'addFoodPackageToParties',
            },
            {
                title: 'Get self catered parties by notes',
                value: 'getSelfCateredPartiesByNotes',
            },
            {
                title: 'Remove Preschool Program class',
                description: 'Cancel one class across enrolments and clean up Firestore appointment ids',
                value: 'removePreschoolProgramClass',
            },
            {
                title: 'Import Google reviews to Mixpanel',
                description: 'Imports historical Google Business Profile reviews as Mixpanel events',
                value: 'importGoogleReviewsToMixpanel',
            },
            {
                title: 'Restore Holiday Program contact phones in Zoho',
                description:
                    'Copies the phone (and last name) from Holiday Program deals onto contacts wiped by check-in',
                value: 'restoreHolidayProgramContactPhones',
            },
        ],
    })
    if (script === 'legacyEventsGrouping') {
        await groupEventsByContactEmail()
    }
    if (script === 'deleteLegacyCalendarEvents') {
        await deleteFromLegacy()
    }
    if (script === 'migrateLegacyEvents') {
        await migrateLegacyEvents()
    }
    if (script === 'migrateScienceEnrolments') {
        await migrateScienceEnrolments()
    }
    if (script === 'addChildSupportToExistingEnrolments') {
        await migration_addChildSupportToAllExistingEnrolments()
    }
    if (script === 'signAnaphylaxisPlan') {
        const { enrolmentId } = await prompts({
            type: 'text',
            name: 'enrolmentId',
            message: 'Please enter the enrolment id:',
        })
        await getAfterSchoolProgramAnaphylaxisPlanSignedUrl(enrolmentId)
    }
    if (script === 'listAllUsers') {
        await getAllUsers()
    }

    if (script === 'deleteEventsByEmail') {
        const { email } = await prompts({
            type: 'text',
            name: 'email',
            message: 'Enter the email to delete by:',
        })
        await deleteEvents(email)
    }
    if (script === 'addFoodPackageToParties') {
        await addFoodPackageToAllParties()
    }
    if (script === 'getSelfCateredPartiesByNotes') {
        await getSelfCateredPartiesByNotes()
    }
    if (script === 'removePreschoolProgramClass') {
        await runRemovePreschoolProgramClassScript()
    }
    if (script === 'importGoogleReviewsToMixpanel') {
        await importGoogleReviewsToMixpanel()
    }
    if (script === 'restoreHolidayProgramContactPhones') {
        await restoreHolidayProgramContactPhones()
    }
    if (script === 'getParties') {
        const { startDate, endDate, location, type } = await prompts([
            { type: 'date', name: 'startDate', message: 'Enter a start date', initial: new Date() },
            {
                type: 'date',
                name: 'endDate',
                message: 'Enter an end date',
                initial: (prev) => DateTime.fromJSDate(prev).plus({ years: 10 }).toJSDate(),
            },
            {
                type: 'select',
                name: 'filterByLocation',
                message: 'Get all bookings, or filter by location?',
                choices: [
                    {
                        title: 'All bookings',
                        value: 'all',
                    },
                    {
                        title: 'Certain location',
                        value: 'certainLocation',
                    },
                ],
            },
            {
                type: (prev) => (prev === 'certainLocation' ? 'select' : null),
                name: 'location',
                message: 'Select the location',
                choices: STUDIOS.map((it) => ({
                    value: it,
                    title: it,
                })),
            },
            {
                type: 'select',
                name: 'filterByType',
                message: 'Get all bookings, or filter by type?',
                choices: [
                    {
                        title: 'All bookings',
                        value: 'all',
                    },
                    {
                        title: 'Certain type',
                        value: 'certainType',
                    },
                ],
            },
            {
                type: (prev) => (prev === 'certainType' ? 'select' : null),
                name: 'type',
                message: 'Select the type',
                choices: [
                    {
                        value: 'studio',
                        title: 'In studio',
                    },
                    {
                        value: 'mobile',
                        title: 'Mobile',
                    },
                ],
            },
        ])
        getParties({
            from: new Date(startDate),
            to: new Date(endDate),
            ...(location && { location }),
            ...(type && { type }),
        })
    }
    if (script === 'updatePartiesToOldPrices') {
        await updatePartiesToOldPrices()
    }
    if (script === 'runBookingsReport') {
        const { startDate, endDate, studio } = await prompts([
            {
                type: 'date',
                name: 'startDate',
                message: 'Enter a start date',
                initial: new Date(),
            },
            {
                type: 'date',
                name: 'endDate',
                message: 'Enter an end date',
                initial: (prev) => DateTime.fromJSDate(prev).plus({ years: 10 }).toJSDate(),
            },
            {
                type: 'select',
                name: 'studio',
                message: 'Select the studio',
                choices: STUDIOS.map((it) => ({
                    value: it,
                    title: it,
                })),
            },
        ])

        const parties = await getParties({ from: startDate, to: endDate, studio })
        const events = await getEvents({ from: startDate, to: endDate, studio })
        const holidayPrograms = await getHolidayPrograms({ from: startDate, to: endDate, studio })

        console.table({
            Parties: parties.length,
            Events: events.length,
            'Holiday bookings': holidayPrograms.length,
        })
    }
    if (script === 'updateSlingWages') {
        await updateSlingWages()
    }
    if (script === 'clearStaleInvitations') {
        const result = await cleanUpStaleInvitations()
        console.log(result)
    }
    if (script === 'sendMinimumShiftLengthReport') {
        const defaultEndDate = DateTime.now().setZone('Australia/Melbourne').minus({ days: 1 }).startOf('day')
        const defaultStartDate = defaultEndDate.minus({ days: 13 }).startOf('day')

        const { startDate, endDate, confirmed } = await prompts([
            {
                type: 'date',
                name: 'startDate',
                message: 'Enter a start date',
                initial: defaultStartDate.toJSDate(),
            },
            {
                type: 'date',
                name: 'endDate',
                message: 'Enter an end date',
                initial: defaultEndDate.toJSDate(),
            },
            {
                type: 'confirm',
                name: 'confirmed',
                message:
                    'This will send real emails to kym@fizzkidz.com.au, balwyn@fizzkidz.com.au, and kingsville@fizzkidz.com.au when those reports have shifts. Continue?',
                initial: false,
            },
        ])

        if (!confirmed) {
            console.log('Cancelled minimum shift length report')
            return
        }

        await sendMinimumShiftLengthReport({ startDate, endDate })
    }
    // get all holiday program bookings for a certain time period and calculate the total spent.
    // used for franchise ownership transfer, to know how many future bookings made.
    if (script === 'runHolidayProgramsReport') {
        const { startDate, endDate, studio } = await prompts([
            { type: 'date', name: 'startDate', message: 'Enter a start date', initial: new Date() },
            {
                type: 'date',
                name: 'endDate',
                message: 'Enter an end date',
                initial: (prev) => DateTime.fromJSDate(prev).plus({ years: 10 }).toJSDate(),
            },
            {
                type: 'select',
                name: 'studio',
                message: 'Select the studio',
                choices: STUDIOS.map((it) => ({
                    value: it,
                    title: it,
                })),
            },
        ])

        const holidayPrograms = await getHolidayPrograms({ from: startDate, to: endDate, studio })

        const orderLookups = holidayPrograms.map((program) => ({
            orderId: AcuityUtilities.retrieveFormAndField(
                program,
                AcuityConstants.Forms.PAYMENT,
                AcuityConstants.FormFields.ORDER_ID
            ),
            lineItemIdentifier: AcuityUtilities.retrieveFormAndField(
                program,
                AcuityConstants.Forms.PAYMENT,
                AcuityConstants.FormFields.LINE_ITEM_IDENTIFIER
            ),
        }))

        const square = await SquareClient.getInstance()
        const ordersById = new Map<string, Square.Order>()
        const orderIds = Array.from(new Set(orderLookups.map((lookup) => lookup.orderId).filter((orderId) => orderId)))

        for (let i = 0; i < orderIds.length; i += 100) {
            const batch = orderIds.slice(i, i + 100)
            const response = await square.orders.batchGet({ orderIds: batch })
            response.orders?.forEach((order) => {
                if (order.id) {
                    ordersById.set(order.id, order)
                }
            })
        }

        let total = 0
        orderLookups.forEach(({ orderId, lineItemIdentifier }) => {
            if (!orderId || !lineItemIdentifier) {
                console.log('Could not find order: ', { orderId, lineItemIdentifier })
                return
            }
            const order = ordersById.get(orderId)
            const lineItem = order?.lineItems?.find((item) => item.metadata?.lineItemIdentifier === lineItemIdentifier)
            if (lineItem?.totalMoney?.amount || lineItem?.totalMoney?.amount === BigInt(0)) {
                total += Number(lineItem.totalMoney.amount)
            } else {
                console.log('Could not find amount spent: ', { orderId, lineItemIdentifier })
            }
        })
        console.table({
            Bookings: holidayPrograms.length,
            Spend: `$${total / 100}`,
        })
    }
})()
