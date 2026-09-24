import { TRPCError } from '@trpc/server'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants, AcuityUtilities, getHolidayProgramChangeEligibility } from '@fizz-kidz/core'

import { verifyAppointmentManagementToken } from './appointment-management-link'
import { sendConfirmationEmail } from './send-confirmation-email'

import { AcuityClient } from '@/integrations/acuity/acuity.client'
import { mergeAcuityWithSanity } from '@/integrations/acuity/core/merge-sanity-with-acuity'
import { logError } from '@/integrations/observability/log-error'

type Access = { appointmentId: number; token: string }

async function loadAppointment(input: Access) {
    if (!verifyAppointmentManagementToken(input.appointmentId, input.token)) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'This booking link is invalid. Please use the link in your confirmation email.',
        })
    }
    const acuity = await AcuityClient.getInstance()
    const appointment = await acuity.getAppointment(String(input.appointmentId))
    return { acuity, appointment }
}

function presentAppointment(appointment: AcuityTypes.Api.Appointment) {
    return {
        id: appointment.id,
        childName: AcuityUtilities.retrieveFormAndField(
            appointment,
            AcuityConstants.Forms.CHILDREN_DETAILS,
            AcuityConstants.FormFields.CHILDREN_NAMES
        ),
        datetime: appointment.datetime,
        duration: appointment.duration,
        studio: appointment.calendar,
        address: appointment.location,
        canceled: !!appointment.canceled,
        ...getHolidayProgramChangeEligibility(appointment.datetime, appointment.canceled),
    }
}

function assertCanReschedule(appointment: AcuityTypes.Api.Appointment) {
    if (!getHolidayProgramChangeEligibility(appointment.datetime, appointment.canceled).canReschedule) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Rescheduling is only available at least 48 hours before your session.',
        })
    }
}

async function getAvailableSessions(acuity: AcuityClient, appointment: AcuityTypes.Api.Appointment) {
    const classes = await acuity.getClasses([appointment.appointmentTypeID], true, Date.now())
    return classes.filter((klass) => klass.calendarID === appointment.calendarID && klass.id !== appointment.classID)
}

export async function getManagedAppointment(input: Access) {
    const { appointment } = await loadAppointment(input)
    return presentAppointment(appointment)
}

export async function getRescheduleSessions(input: Access) {
    const { acuity, appointment } = await loadAppointment(input)
    assertCanReschedule(appointment)
    const sessions = await getAvailableSessions(acuity, appointment)
    return mergeAcuityWithSanity(sessions)
}

export async function cancelManagedAppointment(input: Access) {
    const { acuity, appointment } = await loadAppointment(input)
    if (!getHolidayProgramChangeEligibility(appointment.datetime, appointment.canceled).canCancel) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'This session can no longer be cancelled. Please contact us about your booking.',
        })
    }
    // the acuity cancellation webhook handles refunds and the cancellation email
    await acuity.cancelAppointment(appointment.id)
    return presentAppointment({ ...appointment, canceled: true })
}

export async function rescheduleManagedAppointment(input: Access & { classId: number }) {
    const { acuity, appointment } = await loadAppointment(input)
    assertCanReschedule(appointment)
    const sessions = await getAvailableSessions(acuity, appointment)
    const replacement = sessions.find((klass) => klass.id === input.classId)
    if (!replacement) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'That session is no longer available. Please choose another session.',
        })
    }
    // acuity performs the capacity check
    const updated = await acuity
        .rescheduleAppointment(appointment.id, replacement.time, appointment.calendarID)
        .catch(() => {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'We could not move your booking to that session. Please choose another session.',
            })
        })
    try {
        await sendConfirmationEmail([updated], undefined, true)
    } catch (err) {
        logError('Error sending holiday program rescheduling confirmation email', err, { appointmentId: updated.id })
    }
    return presentAppointment(updated)
}
