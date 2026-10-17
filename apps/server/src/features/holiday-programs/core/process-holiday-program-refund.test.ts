import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants, EVENT_POLICY } from '@fizz-kidz/core'

import type { AcuityWebhookData } from '@/integrations/acuity/functions/acuity.webhook'

const mocks = vi.hoisted(() => ({
    getAppointment: vi.fn(),
    getOrder: vi.fn(),
    getPayment: vi.fn(),
    refundPayment: vi.fn(),
    sendEmail: vi.fn(),
}))

vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))
vi.mock('@/integrations/acuity/acuity.client', () => ({
    AcuityClient: { getInstance: async () => ({ getAppointment: mocks.getAppointment }) },
}))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: {
        getInstance: async () => ({
            orders: { get: mocks.getOrder },
            payments: { get: mocks.getPayment },
            refunds: { refundPayment: mocks.refundPayment },
        }),
    },
}))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))

import { processHolidayProgramRefund } from './process-holiday-program-refund'

function eventAppointment(datetime: string) {
    return {
        id: 1,
        appointmentTypeID: AcuityConstants.AppointmentTypes.OPEN_DAY,
        type: 'Halloween Spookfest',
        email: 'parent@example.com',
        firstName: 'Parent',
        calendar: 'Werribee',
        datetime,
        duration: '60',
        forms: [
            {
                id: AcuityConstants.Forms.PAYMENT,
                values: [
                    { fieldID: AcuityConstants.FormFields.ORDER_ID, value: 'order-id' },
                    { fieldID: AcuityConstants.FormFields.LINE_ITEM_IDENTIFIER, value: 'line-item' },
                ],
            },
        ],
    } as unknown as AcuityTypes.Api.Appointment
}

describe('event cancellation refunds', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-20T10:00:00+11:00'))
        vi.clearAllMocks()
        mocks.getOrder.mockResolvedValue({
            order: {
                lineItems: [{ metadata: { lineItemIdentifier: 'line-item' }, totalMoney: { amount: 2000n } }],
                tenders: [{ id: 'tender', paymentId: 'payment', amountMoney: { amount: 2000n, currency: 'AUD' } }],
            },
        })
        mocks.getPayment.mockResolvedValue({ payment: { receiptUrl: 'https://example.com/receipt' } })
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('refunds at least 48 hours before and names the event in the email', async () => {
        mocks.getAppointment.mockResolvedValue(eventAppointment('2026-10-30T16:00:00+11:00'))

        await processHolidayProgramRefund({ id: '1' } as AcuityWebhookData)

        expect(mocks.refundPayment).toHaveBeenCalledWith(
            expect.objectContaining({ paymentId: 'payment', amountMoney: { amount: 2000n, currency: 'AUD' } })
        )
        expect(mocks.sendEmail).toHaveBeenCalledWith(
            'holidayProgramCancellation',
            'parent@example.com',
            expect.objectContaining({
                programName: 'Halloween Spookfest',
                policy: EVENT_POLICY,
                receiptUrl: 'https://example.com/receipt',
            }),
            { subject: 'Halloween Spookfest booking cancelled' }
        )
    })

    it('does not refund inside 48 hours', async () => {
        mocks.getAppointment.mockResolvedValue(eventAppointment('2026-10-21T16:00:00+11:00'))

        await processHolidayProgramRefund({ id: '1' } as AcuityWebhookData)

        expect(mocks.refundPayment).not.toHaveBeenCalled()
        expect(mocks.sendEmail).toHaveBeenCalledWith(
            'holidayProgramCancellation',
            'parent@example.com',
            expect.objectContaining({ programName: 'Halloween Spookfest', receiptUrl: '' }),
            { subject: 'Halloween Spookfest booking cancelled' }
        )
    })
})
