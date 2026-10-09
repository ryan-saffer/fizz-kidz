import { DateTime } from 'luxon'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants, AcuityUtilities } from '@fizz-kidz/core'

import { getAppointmentManagementUrl } from './appointment-management-link'

import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

/** Sends a short confirmation showing the session a booking moved from and to. */
export async function sendRescheduledEmail({
    programName,
    previous,
    updated,
}: {
    programName: string
    previous: AcuityTypes.Api.Appointment
    updated: AcuityTypes.Api.Appointment
}) {
    const mailClient = await MailClient.getInstance()
    await mailClient.sendEmail('programSessionRescheduled', updated.email, {
        parentName: updated.firstName,
        programName,
        childName: AcuityUtilities.retrieveFormAndField(
            updated,
            AcuityConstants.Forms.CHILDREN_DETAILS,
            AcuityConstants.FormFields.CHILDREN_NAMES
        ),
        previousSession: formatSession(previous),
        newSession: formatSession(updated),
        location: `Fizz Kidz ${updated.calendar}`,
        address: updated.location,
        managementUrl: getAppointmentManagementUrl(updated.id),
    })
}

function formatSession(appointment: AcuityTypes.Api.Appointment) {
    const start = DateTime.fromISO(appointment.datetime, { setZone: true })
    const end = start.plus({ minutes: parseInt(appointment.duration) })
    return `${start.toFormat('cccc d LLLL, h:mm a')} to ${end.toFormat('h:mm a')}`
}
