import { DateTime } from 'luxon'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants, AcuityUtilities, PRESCHOOL_PROGRAM_POLICY, studioNameAndAddress } from '@fizz-kidz/core'

import { getAppointmentManagementUrl } from '@/features/program-bookings/core/appointment-management-link'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

/** Sends the branded booking confirmation for a session moved from the management page. */
export async function sendPreschoolProgramV2RescheduledEmail(appointment: AcuityTypes.Api.Appointment) {
    const startTime = DateTime.fromISO(appointment.datetime, { setZone: true })
    const endTime = startTime.plus({ minutes: parseInt(appointment.duration) })
    const mailClient = await MailClient.getInstance()

    await mailClient.sendEmail(
        'preschoolProgramV2BookingConfirmation',
        appointment.email,
        {
            parentName: appointment.firstName,
            location: studioNameAndAddress(AcuityUtilities.getStudioByCalendarId(appointment.calendarID)),
            bookings: [
                {
                    time: `${startTime.toFormat('cccc, LLL dd, h:mm a')} - ${endTime.toFormat('h:mm a')}`,
                    details: AcuityUtilities.retrieveFormAndField(
                        appointment,
                        AcuityConstants.Forms.CHILDREN_DETAILS,
                        AcuityConstants.FormFields.CHILDREN_NAMES
                    ),
                    confirmationPage: getAppointmentManagementUrl(appointment.id),
                    isFullTermDiscount: false,
                },
            ],
            receiptUrl: undefined,
            rescheduled: true,
            policy: PRESCHOOL_PROGRAM_POLICY,
        },
        { subject: 'Preschool Program rescheduling confirmation' }
    )
}
