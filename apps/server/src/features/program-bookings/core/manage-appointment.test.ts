import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants } from '@fizz-kidz/core'

const mocks = vi.hoisted(() => ({
    getAppointment: vi.fn(),
    getClasses: vi.fn(),
    cancelAppointment: vi.fn(),
    rescheduleAppointment: vi.fn(),
    sendRescheduledEmail: vi.fn(),
    quoteHolidayProgramRefund: vi.fn(),
    quotePreschoolProgramV2Refund: vi.fn(),
    logError: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))
vi.mock('@/integrations/acuity/acuity.client', () => ({ AcuityClient: { getInstance: async () => mocks } }))
vi.mock('@/integrations/acuity/core/merge-sanity-with-acuity', () => ({
    mergeAcuityWithSanity: async (classes: unknown) => classes,
}))
vi.mock('./send-rescheduled-email', () => ({ sendRescheduledEmail: mocks.sendRescheduledEmail }))
vi.mock('@/features/holiday-programs/core/process-holiday-program-refund', () => ({
    quoteHolidayProgramRefund: mocks.quoteHolidayProgramRefund,
}))
vi.mock('@/features/preschool-program-v2/core/process-preschool-program-v2-refund', () => ({
    quotePreschoolProgramV2Refund: mocks.quotePreschoolProgramV2Refund,
}))

import { createAppointmentManagementToken, verifyAppointmentManagementToken } from './appointment-management-link'
import {
    cancelManagedAppointment,
    getCancellationRefund,
    getRescheduleSessions,
    rescheduleManagedAppointment,
} from './manage-appointment'

function appointment(overrides: Partial<AcuityTypes.Api.Appointment> = {}) {
    return {
        id: 123,
        classID: 10,
        appointmentTypeID: AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM,
        datetime: '2026-10-04T10:00:00+10:00',
        duration: '180',
        calendarID: 55,
        calendar: 'Malvern',
        location: 'Studio address',
        forms: [],
        ...overrides,
    } as unknown as AcuityTypes.Api.Appointment
}
const session = { id: 11, calendarID: 55, time: '2026-10-02T10:00:00+10:00', slotsAvailable: 1 }
const access = () => ({ appointmentId: 123, token: createAppointmentManagementToken(123) })

describe('holiday program appointment management', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-01T10:00:00+10:00'))
        vi.stubEnv('ACUITY_API_KEY', 'test-signing-key')
        vi.clearAllMocks()
        mocks.getAppointment.mockResolvedValue(appointment())
        mocks.getClasses.mockResolvedValue([session])
        mocks.rescheduleAppointment.mockResolvedValue(appointment({ datetime: session.time, classID: 11 }))
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllEnvs()
    })

    it('verifies tokens per appointment', () => {
        const token = createAppointmentManagementToken(123)
        expect(verifyAppointmentManagementToken(123, token)).toBe(true)
        expect(verifyAppointmentManagementToken(124, token)).toBe(false)
        expect(verifyAppointmentManagementToken(123, 'bad')).toBe(false)
    })

    it('rejects an invalid token', async () => {
        await expect(cancelManagedAppointment({ appointmentId: 123, token: 'bad' })).rejects.toMatchObject({
            code: 'NOT_FOUND',
        })
        expect(mocks.getAppointment).not.toHaveBeenCalled()
    })

    it('reschedules and emails the previous and new session', async () => {
        await rescheduleManagedAppointment({ ...access(), classId: 11 })
        expect(mocks.rescheduleAppointment).toHaveBeenCalledWith(123, session.time, 55)
        expect(mocks.sendRescheduledEmail).toHaveBeenCalledWith({
            programName: 'holiday program',
            previous: expect.objectContaining({ datetime: '2026-10-04T10:00:00+10:00' }),
            updated: expect.objectContaining({ datetime: session.time }),
        })
    })

    it('still succeeds when the confirmation email fails', async () => {
        mocks.sendRescheduledEmail.mockRejectedValueOnce(new Error('SendGrid down'))
        expect((await rescheduleManagedAppointment({ ...access(), classId: 11 })).datetime).toBe(session.time)
        expect(mocks.logError).toHaveBeenCalled()
    })

    it('blocks rescheduling inside 48 hours but still allows cancelling', async () => {
        mocks.getAppointment.mockResolvedValue(appointment({ datetime: '2026-10-02T10:00:00+10:00' }))
        await expect(rescheduleManagedAppointment({ ...access(), classId: 11 })).rejects.toMatchObject({
            code: 'PRECONDITION_FAILED',
        })
        expect((await cancelManagedAppointment(access())).canceled).toBe(true)
        expect(mocks.cancelAppointment).toHaveBeenCalledWith(123)
    })

    it('rejects appointments from other programs', async () => {
        mocks.getAppointment.mockResolvedValue(
            appointment({ appointmentTypeID: AcuityConstants.AppointmentTypes.OPEN_DAY })
        )
        await expect(cancelManagedAppointment(access())).rejects.toMatchObject({ code: 'NOT_FOUND' })
        expect(mocks.cancelAppointment).not.toHaveBeenCalled()
    })

    it('previews the holiday program refund', async () => {
        mocks.quoteHolidayProgramRefund.mockResolvedValue({ refundCents: 6500 })
        expect(await getCancellationRefund(access())).toEqual({ refundCents: 6500, fullTermDiscountRemoved: false })
    })
})

describe('preschool program appointment management', () => {
    // Tuesday and Friday terms, then a second term after the school holidays
    const klass = (id: number, time: string, calendarID = 55) => ({ id, calendarID, time, slotsAvailable: 4 })
    const classes = [
        klass(1, '2026-09-08T09:30:00+10:00'),
        klass(2, '2026-09-11T09:30:00+10:00'),
        klass(3, '2026-10-06T09:30:00+11:00'),
        klass(4, '2026-10-09T09:30:00+11:00'),
        klass(5, '2026-10-13T09:30:00+11:00'),
        klass(6, '2026-10-16T09:30:00+11:00'),
        klass(7, '2026-10-16T09:30:00+11:00', 99),
        klass(8, '2027-01-26T09:30:00+11:00'),
        klass(9, '2027-01-29T09:30:00+11:00'),
    ]
    const preschoolAppointment = (overrides: Partial<AcuityTypes.Api.Appointment> = {}) =>
        appointment({
            appointmentTypeID: AcuityConstants.AppointmentTypes.PRESCHOOL_PROGRAM,
            classID: 3,
            datetime: classes[2].time,
            duration: '120',
            ...overrides,
        })

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-01T10:00:00+10:00'))
        vi.stubEnv('ACUITY_API_KEY', 'test-signing-key')
        vi.clearAllMocks()
        mocks.getAppointment.mockResolvedValue(preschoolAppointment())
        mocks.getClasses.mockResolvedValue(classes)
        mocks.rescheduleAppointment.mockResolvedValue(preschoolAppointment({ classID: 6, datetime: classes[5].time }))
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllEnvs()
    })

    it('offers later sessions on any day in the same term at the same studio', async () => {
        const sessions = await getRescheduleSessions(access())
        expect(sessions.map(({ id }) => id)).toEqual([4, 5, 6])
    })

    it('does not move a session into another term', async () => {
        await expect(rescheduleManagedAppointment({ ...access(), classId: 8 })).rejects.toMatchObject({
            code: 'NOT_FOUND',
        })
        expect(mocks.rescheduleAppointment).not.toHaveBeenCalled()
    })

    it('reschedules and emails the previous and new session', async () => {
        await rescheduleManagedAppointment({ ...access(), classId: 6 })
        expect(mocks.rescheduleAppointment).toHaveBeenCalledWith(123, classes[5].time, 55)
        expect(mocks.sendRescheduledEmail).toHaveBeenCalledWith({
            programName: 'Preschool Program',
            previous: expect.objectContaining({ datetime: classes[2].time }),
            updated: expect.objectContaining({ datetime: classes[5].time }),
        })
    })

    it('previews the preschool refund', async () => {
        const quote = { refundCents: 0, sessionPaidCents: 3120, fullTermDiscountRemoved: true }
        mocks.quotePreschoolProgramV2Refund.mockResolvedValue(quote)
        expect(await getCancellationRefund(access())).toEqual(quote)
    })
})
