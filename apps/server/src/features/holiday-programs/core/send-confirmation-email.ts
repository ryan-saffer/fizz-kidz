import { DateTime } from 'luxon'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants, AcuityUtilities, getStudioAddress } from '@fizz-kidz/core'

import type { Emails } from '@/integrations/sendgrid/types'

import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

type ConfirmationAppointmentType =
    | typeof AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM
    | typeof AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM
    | typeof AcuityConstants.AppointmentTypes.WERRIBEE_OPENING

export async function sendConfirmationEmail(
    appointments: AcuityTypes.Api.Appointment[],
    receiptUrl: string | undefined
) {
    const sortedAppointments = appointments.sort((a, b) => {
        const child1Name = AcuityUtilities.retrieveFormAndField(
            a,
            AcuityConstants.Forms.CHILDREN_DETAILS,
            AcuityConstants.FormFields.CHILDREN_NAMES
        )
        const child2Name = AcuityUtilities.retrieveFormAndField(
            b,
            AcuityConstants.Forms.CHILDREN_DETAILS,
            AcuityConstants.FormFields.CHILDREN_NAMES
        )
        return a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : child1Name < child2Name ? 1 : -1
    })
    const bookings: Emails['holidayProgramConfirmation']['bookings'] = sortedAppointments.map((appointment) => {
        const startTime = DateTime.fromISO(appointment.datetime, { setZone: true })
        const endTime = startTime.plus({ minutes: parseInt(appointment.duration) })
        return {
            datetime: `${AcuityUtilities.retrieveFormAndField(
                appointment,
                AcuityConstants.Forms.CHILDREN_DETAILS,
                AcuityConstants.FormFields.CHILDREN_NAMES
            )} - ${startTime.toFormat('cccc, LLL dd, t')} - ${endTime.toFormat('t')}`,
            confirmationPage: appointment.confirmationPage,
        }
    })

    const mailClient = await MailClient.getInstance()

    const appointmentTypeId = sortedAppointments[0].appointmentTypeID as ConfirmationAppointmentType
    switch (appointmentTypeId) {
        case AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM:
        case AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM: {
            await mailClient.sendEmail('holidayProgramConfirmation', appointments[0].email, {
                parentName: appointments[0].firstName,
                location: `Fizz Kidz ${appointments[0].calendar}`,
                address: appointments[0].location,
                bookings,
                receiptUrl,
            })
            break
        }
        case AcuityConstants.AppointmentTypes.WERRIBEE_OPENING:
            await mailClient.sendEmail('werribeeOpeningConfirmation', appointments[0].email, {
                parentName: appointments[0].firstName,
                location: 'Fizz Kidz Werribee Studio',
                address: getStudioAddress('werribee'),
                bookings,
            })
            break
        default: {
            const exhaustiveCheck: never = appointmentTypeId
            throw new Error(`Unhandled booking confirmation email for program with id: ${exhaustiveCheck}`)
        }
    }
    return
}
