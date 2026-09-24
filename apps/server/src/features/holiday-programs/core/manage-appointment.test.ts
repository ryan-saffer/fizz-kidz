import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants } from '@fizz-kidz/core'

const mocks = vi.hoisted(() => ({
    getAppointment: vi.fn(),
    getClasses: vi.fn(),
    cancelAppointment: vi.fn(),
    rescheduleAppointment: vi.fn(),
    sendConfirmationEmail: vi.fn(),
    logError: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))
vi.mock('@/integrations/acuity/acuity.client', () => ({ AcuityClient: { getInstance: async () => mocks } }))
vi.mock('@/integrations/acuity/core/merge-sanity-with-acuity', () => ({
    mergeAcuityWithSanity: async (classes: unknown) => classes,
}))
vi.mock('./send-confirmation-email', () => ({ sendConfirmationEmail: mocks.sendConfirmationEmail }))

import { createAppointmentManagementToken, verifyAppointmentManagementToken } from './appointment-management-link'
import { cancelManagedAppointment, rescheduleManagedAppointment } from './manage-appointment'

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

    it('reschedules and sends an updated confirmation', async () => {
        await rescheduleManagedAppointment({ ...access(), classId: 11 })
        expect(mocks.rescheduleAppointment).toHaveBeenCalledWith(123, session.time, 55)
        expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(
            [expect.objectContaining({ id: 123 })],
            undefined,
            true
        )
    })

    it('still succeeds when the confirmation email fails', async () => {
        mocks.sendConfirmationEmail.mockRejectedValueOnce(new Error('SendGrid down'))
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
})
