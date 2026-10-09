import { TRPCError } from '@trpc/server'
import { DateTime } from 'luxon'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants, AcuityUtilities, getSessionChangeEligibility } from '@fizz-kidz/core'

import { verifyAppointmentManagementToken } from './appointment-management-link'

import { quoteHolidayProgramRefund } from '@/features/holiday-programs/core/process-holiday-program-refund'
import { sendConfirmationEmail } from '@/features/holiday-programs/core/send-confirmation-email'
import {
    getSameTermClasses,
    TERM_LOOKBACK_MONTHS,
} from '@/features/preschool-program-v2/core/preschool-program-v2-terms'
import { quotePreschoolProgramV2Refund } from '@/features/preschool-program-v2/core/process-preschool-program-v2-refund'
import { sendPreschoolProgramV2RescheduledEmail } from '@/features/preschool-program-v2/core/send-preschool-program-v2-rescheduled-email'
import { AcuityClient } from '@/integrations/acuity/acuity.client'
import { mergeAcuityWithSanity } from '@/integrations/acuity/core/merge-sanity-with-acuity'
import { logError } from '@/integrations/observability/log-error'

type Access = { appointmentId: number; token: string }
type Appointment = AcuityTypes.Api.Appointment
type ReplacementSession = AcuityTypes.Api.Class & { title?: string }

/** What differs between the programs that can be managed from the confirmation email link. */
const PROGRAMS = {
    'holiday-program': {
        // any later session at the same studio
        async getReplacementSessions(acuity: AcuityClient, appointment: Appointment): Promise<ReplacementSession[]> {
            const classes = await acuity.getClasses([appointment.appointmentTypeID], true, Date.now())
            return mergeAcuityWithSanity(
                classes.filter(
                    (klass) => klass.calendarID === appointment.calendarID && klass.id !== appointment.classID
                )
            )
        },
        sendRescheduledEmail: (appointment: Appointment) => sendConfirmationEmail([appointment], undefined, true),
        quoteRefund: async (appointment: Appointment) => ({
            ...(await quoteHolidayProgramRefund(appointment)),
            fullTermDiscountRemoved: false,
        }),
    },
    'preschool-program': {
        // any later session at the same studio in the same term, on any day
        async getReplacementSessions(acuity: AcuityClient, appointment: Appointment): Promise<ReplacementSession[]> {
            const classes = await acuity.getClasses(
                [appointment.appointmentTypeID],
                true,
                DateTime.now().minus({ months: TERM_LOOKBACK_MONTHS }).toMillis()
            )
            return getSameTermClasses(appointment.classID, classes).filter(
                (klass) => DateTime.fromISO(klass.time, { setZone: true }).toMillis() > Date.now()
            )
        },
        sendRescheduledEmail: sendPreschoolProgramV2RescheduledEmail,
        quoteRefund: quotePreschoolProgramV2Refund,
    },
}

type Program = keyof typeof PROGRAMS

function getProgram(appointment: Appointment): Program {
    switch (appointment.appointmentTypeID) {
        case AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM:
        case AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM:
            return 'holiday-program'
        case AcuityConstants.AppointmentTypes.PRESCHOOL_PROGRAM:
        case AcuityConstants.AppointmentTypes.TEST_PRESCHOOL_PROGRAM:
            return 'preschool-program'
        default:
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'This booking cannot be managed online. Please contact us about your booking.',
            })
    }
}

async function loadAppointment(input: Access) {
    if (!verifyAppointmentManagementToken(input.appointmentId, input.token)) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'This booking link is invalid. Please use the link in your confirmation email.',
        })
    }
    const acuity = await AcuityClient.getInstance()
    const appointment = await acuity.getAppointment(String(input.appointmentId))
    const program = getProgram(appointment)
    return { acuity, appointment, program, config: PROGRAMS[program] }
}

function presentAppointment(appointment: Appointment) {
    return {
        id: appointment.id,
        program: getProgram(appointment),
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
        ...getSessionChangeEligibility(appointment.datetime, appointment.canceled),
    }
}

function assertCanReschedule(appointment: Appointment) {
    if (!getSessionChangeEligibility(appointment.datetime, appointment.canceled).canReschedule) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Rescheduling is only available at least 48 hours before your session.',
        })
    }
}

export async function getManagedAppointment(input: Access) {
    const { appointment } = await loadAppointment(input)
    return presentAppointment(appointment)
}

export async function getRescheduleSessions(input: Access) {
    const { acuity, appointment, config } = await loadAppointment(input)
    assertCanReschedule(appointment)
    return config.getReplacementSessions(acuity, appointment)
}

/** Previews the refund for cancelling now, so the parent knows what to expect before confirming. */
export async function getCancellationRefund(input: Access) {
    const { appointment, config } = await loadAppointment(input)
    try {
        return await config.quoteRefund(appointment)
    } catch (err) {
        logError('Unable to preview program booking refund', err, { appointmentId: appointment.id })
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'We could not work out your refund.' })
    }
}

export async function cancelManagedAppointment(input: Access) {
    const { acuity, appointment } = await loadAppointment(input)
    if (!getSessionChangeEligibility(appointment.datetime, appointment.canceled).canCancel) {
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
    const { acuity, appointment, program, config } = await loadAppointment(input)
    assertCanReschedule(appointment)
    const sessions = await config.getReplacementSessions(acuity, appointment)
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
        await config.sendRescheduledEmail(updated)
    } catch (err) {
        logError(`Error sending ${program} rescheduling confirmation email`, err, { appointmentId: updated.id })
    }
    return presentAppointment(updated)
}
