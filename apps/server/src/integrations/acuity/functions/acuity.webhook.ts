import express from 'express'
import { logger } from 'firebase-functions/v2'

import { AcuityConstants, AcuityUtilities } from '@fizz-kidz/core'

import { AcuityClient } from '../acuity.client'

import { checkInToCrm } from '@/features/holiday-programs/core/check-in-to-crm'
import { processHolidayProgramRefund } from '@/features/holiday-programs/core/process-holiday-program-refund'
import { processPreschoolProgramV2Refund } from '@/features/preschool-program-v2/core/process-preschool-program-v2-refund'
import { logError } from '@/integrations/observability/log-error'
import { ZohoClient } from '@/integrations/zoho/zoho.client'

export type AcuityWebhookData = {
    action: 'scheduled' | 'rescheduled' | 'canceled' | 'changed' | 'order.completed'
    id: string
    calendarID: string
    appointmentTypeID: string
}

export const acuityWebhook = express.Router()

acuityWebhook.post('/acuity', async (req, resp) => {
    logger.log('STARTING WEBHOOK')
    logger.log(req.body)
    const data = req.body as AcuityWebhookData

    try {
        switch (data.action) {
            case 'canceled':
                // ONLY HOLIDAY PROGRAMS GET REFUNDED - CURRENTLY OTHER PROGRAMS NOT SUPPORTED (ie kingsville opening)
                if (isHolidayProgram(data.appointmentTypeID)) {
                    await processHolidayProgramRefund(data)
                    await updateHolidayProgramZohoRow(data, { status: 'Cancelled' }).catch((error) => {
                        logError('error updating cancelled holiday program Zoho row', error, { data })
                    })
                    resp.status(200).send()
                    return
                } else if (isPreschoolProgramV2(data.appointmentTypeID)) {
                    await processPreschoolProgramV2Refund(data)
                    resp.status(200).send()
                    return
                } else {
                    logger.log('ignoring cancelled program with id:', data.appointmentTypeID)
                    resp.status(200).send()
                    return
                }
            case 'changed':
                // ONLY HOLIDAY PROGRAMS CHECK IN TO CRM - CURRENTLY OTHER PROGRAMS NOT SUPPORTED (ie kingsville opening)
                if (isHolidayProgram(data.appointmentTypeID)) {
                    await checkInToCrm(data).catch((error) => {
                        logError('error checking holiday program into Zoho CRM', error, { data })
                    })
                    resp.status(200).send()
                    return
                } else {
                    logger.log('ignoring changed program with id:', data.appointmentTypeID)
                    resp.status(200).send()
                    return
                }
            case 'rescheduled':
                if (isHolidayProgram(data.appointmentTypeID)) {
                    await updateHolidayProgramZohoRow(data, { status: 'Booked' }).catch((error) => {
                        logError('error updating rescheduled holiday program Zoho row', error, { data })
                    })
                    resp.status(200).send()
                    return
                } else {
                    logger.log('ignoring rescheduled program with id:', data.appointmentTypeID)
                    resp.status(200).send()
                    return
                }
            default:
                logger.log(`Ignoring action: ${data.action}`)
                resp.status(200).send()
                return
        }
    } catch (error) {
        logError('error running acuity webhook', error)
        resp.status(500).send(error)
        return
    }
})

function isHolidayProgram(appointmentTypeId: string) {
    return (
        appointmentTypeId === AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM.toString() ||
        appointmentTypeId === AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM.toString()
    )
}

/** Reports whether an Acuity webhook belongs to a production or test preschool-v2 appointment type. */
function isPreschoolProgramV2(appointmentTypeId: string) {
    return (
        appointmentTypeId === AcuityConstants.AppointmentTypes.PRESCHOOL_PROGRAM.toString() ||
        appointmentTypeId === AcuityConstants.AppointmentTypes.TEST_PRESCHOOL_PROGRAM.toString()
    )
}

async function updateHolidayProgramZohoRow(data: AcuityWebhookData, options: { status?: 'Booked' | 'Cancelled' } = {}) {
    const acuity = await AcuityClient.getInstance()
    const appointment = await acuity.getAppointment(data.id)
    const zoho = new ZohoClient()

    const updated = await zoho.updateHolidayProgramBookingRow({
        email: appointment.email,
        appointmentId: appointment.id,
        status: options.status,
        dateTimeISO: appointment.datetime,
        studio: AcuityUtilities.getStudioByCalendarId(appointment.calendarID),
        bookingUrl: appointment.confirmationPage,
    })

    if (!updated) {
        logError('unable to find holiday program Zoho row for Acuity appointment', null, { appointment })
    }
}
