import { DateTime } from 'luxon'

import type { CreatePreschoolProgramEnrolmentParams, PreschoolProgramEnrolment } from '@fizz-kidz/core'
import { AcuityConstants, studioNameAndAddress } from '@fizz-kidz/core'

import { resolveCalendarStudio } from './resolve-calendar-studio'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { AcuityClient } from '@/integrations/acuity/acuity.client'
import { FirestoreRefs } from '@/integrations/firebase/firestore.refs'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { ZohoClient } from '@/integrations/zoho/zoho.client'

export async function createPreschoolProgramEnrolment(input: CreatePreschoolProgramEnrolmentParams) {
    const newDoc = (await FirestoreRefs.preschoolProgramEnrolments()).doc()

    const acuityClient = await AcuityClient.getInstance()
    const calendars = await acuityClient.getCalendars()
    const calendar = calendars.find((it) => it.id === input.calendarId)

    if (!calendar) {
        throwTrpcError('NOT_FOUND', `could not find matching calendar in acuity with id: ${input.calendarId}`)
    }

    const studio = resolveCalendarStudio(input.calendarId)

    if (!studio) {
        throwTrpcError(
            'INTERNAL_SERVER_ERROR',
            `could not resolve Preschool Program studio from acuity calendar: ${calendar.name}`
        )
    }

    const classes = await acuityClient.getClasses([input.appointmentTypeId], false, Date.now())

    if (classes.length === 0) {
        throwTrpcError(
            'NOT_FOUND',
            `could not find classes in acuity with appointment type id: ${input.appointmentTypeId}`
        )
    }

    const appointments = await (async () => {
        try {
            return await Promise.all(
                classes.map((klass) =>
                    acuityClient.scheduleAppointment({
                        appointmentTypeID: input.appointmentTypeId,
                        datetime: klass.time,
                        firstName: input.parent.firstName,
                        lastName: input.parent.lastName,
                        email: input.parent.email,
                        phone: input.parent.phone,
                        fields: [{ id: AcuityConstants.FormFields.FIRESTORE_ID, value: newDoc.id }],
                    })
                )
            )
        } catch (err) {
            throwTrpcError('INTERNAL_SERVER_ERROR', 'There was an error enrolling into the program', err)
        }
    })()

    const now = new Date()
    const enrolment: PreschoolProgramEnrolment = {
        ...input,
        id: newDoc.id,
        appointments: appointments.map((appointment) => appointment.id),
        price: appointments[0]?.price ?? '0.00',
        status: 'active',
        studio,
        invoiceId: '',
        notes: '',
        createdAt: now,
        updatedAt: now,
        signatures: appointments.reduce(
            (accumulator, appointment) => ({ ...accumulator, [appointment.id]: '' }),
            {} as PreschoolProgramEnrolment['signatures']
        ),
        child: {
            ...input.child,
            allergies: input.child.allergies || '',
            additionalInfo: input.child.additionalInfo || '',
        },
    }

    await newDoc.set(enrolment)

    try {
        const zohoClient = new ZohoClient()
        await zohoClient.addPreschoolProgramContact({
            firstName: input.parent.firstName,
            lastName: input.parent.lastName,
            email: input.parent.email,
            mobile: input.parent.phone,
            studio,
            children: [{ childName: input.child.firstName, childBirthdayISO: input.child.dob }],
            optOutOfMarketing: !input.joinMailingList,
        })
    } catch (err) {
        logError(`unable to add Preschool Program enrolment to zoho with id: ${enrolment.id}`, err)
    }

    try {
        const mailClient = await MailClient.getInstance()
        await mailClient.sendEmail('preschoolProgramBookingConfirmation', input.parent.email, {
            parentName: input.parent.firstName,
            childName: input.child.firstName,
            className: input.className,
            location: studioNameAndAddress(studio),
            appointmentTimes: appointments
                .slice()
                .sort(
                    (a, b) =>
                        DateTime.fromISO(a.datetime, { setZone: true }).toMillis() -
                        DateTime.fromISO(b.datetime, { setZone: true }).toMillis()
                )
                .map((appointment) => {
                    const startTime = DateTime.fromISO(appointment.datetime, { setZone: true })
                    return `${startTime.toFormat('cccc, LLL dd, h:mm a')} - ${startTime
                        .plus({ minutes: parseInt(appointment.duration, 10) })
                        .toFormat('h:mm a')}`
                }),
        })
    } catch (err) {
        logError(`unable to send Preschool Program booking confirmation for enrolment with id: '${enrolment.id}'`, err)
    }

    const mixpanel = await MixpanelClient.getInstance()
    await mixpanel.track('preschool-program-enrolment', {
        distinct_id: input.parent.email,
        appointmentTypeId: input.appointmentTypeId,
        calendarId: input.calendarId,
        location: studio,
        childAge: Math.abs(DateTime.fromISO(input.child.dob).diffNow('years').years).toFixed(0),
        className: input.className,
        numberOfWeeks: appointments.length,
    })

    return enrolment
}
