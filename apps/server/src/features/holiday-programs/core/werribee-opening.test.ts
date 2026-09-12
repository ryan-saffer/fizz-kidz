import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { AcuityConstants, AcuityUtilities, getSquareLocationId } from '@fizz-kidz/core'
import type { AcuityTypes } from '@fizz-kidz/core'

import { processHolidayProgramPayment } from './process-holiday-program-payment'
import { sendConfirmationEmail } from './send-confirmation-email'

import type { HolidayProgramBookingProps } from './book-holiday-program'

const mocks = vi.hoisted(() => ({
    createOrder: vi.fn(),
    payOrder: vi.fn(),
    createPayment: vi.fn(),
    getGiftCard: vi.fn(),
    sendEmail: vi.fn(),
}))

vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/square/core/get-or-create-customer', () => ({
    getOrCreateCustomer: vi.fn().mockResolvedValue('customer-id'),
}))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: {
        getInstance: async () => ({
            orders: { create: mocks.createOrder, pay: mocks.payOrder },
            payments: { create: mocks.createPayment },
            giftCards: { get: mocks.getGiftCard },
        }),
    },
    getSquareError: vi.fn(),
}))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))

function makeBookingInput(giftCardId: string): HolidayProgramBookingProps {
    const calendarId = AcuityConstants.StoreCalendars.werribee
    const studio = AcuityUtilities.getStudioByCalendarId(calendarId)

    return {
        idempotencyKey: 'werribee-order',
        parentFirstName: 'Parent',
        parentLastName: 'Example',
        parentEmail: 'parent@example.com',
        parentPhone: '0400000000',
        emergencyContactName: 'Contact',
        emergencyContactPhone: '0400000001',
        joinMailingList: false,
        numberOfKids: 1,
        payment: {
            token: 'card-token',
            buyerVerificationToken: 'verification-token',
            giftCardId,
            amount: 1500,
            locationId: getSquareLocationId(studio),
            discount: null,
            lineItems: [
                {
                    name: 'Child - Saturday September 19, 10:00 am',
                    quantity: '1',
                    amount: 1500,
                    classId: 120414493,
                    lineItemIdentifier: 'child-session',
                    appointmentTypeId: AcuityConstants.AppointmentTypes.WERRIBEE_OPENING,
                    time: '2026-09-19T10:00:00+10:00',
                    calendarId,
                    childName: 'Child',
                    childDob: '2020-01-01',
                    childAllergies: '',
                    childIsAnaphylactic: false,
                    childAnaphylaxisPlan: '',
                    childAdditionalInfo: '',
                    isAllDayClass: false,
                },
            ],
        },
    }
}

describe('Werribee Open Day booking', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.createOrder.mockResolvedValue({ order: { id: 'order-id', totalMoney: { amount: 1500n } } })
        mocks.payOrder.mockResolvedValue({})
        mocks.getGiftCard.mockResolvedValue({ giftCard: { state: 'ACTIVE', balanceMoney: { amount: 400n } } })
        mocks.createPayment.mockImplementation(async ({ sourceId, amountMoney }) => ({
            payment: {
                id: sourceId === 'gift-card-id' ? 'gift-payment' : 'card-payment',
                amountMoney,
                receiptUrl: 'https://example.com/receipt',
            },
        }))
    })

    it.each(['', 'gift-card-id'])('routes checkout to Werribee with gift card "%s"', async (giftCardId) => {
        await processHolidayProgramPayment(makeBookingInput(giftCardId))

        expect(mocks.createOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                order: expect.objectContaining({ locationId: 'L5Z6AWAMMZY4V' }),
            })
        )
        const payments = mocks.createPayment.mock.calls.map(([payment]) => payment)
        expect(payments).toHaveLength(giftCardId ? 2 : 1)
        expect(payments.every((payment) => payment.locationId === 'L5Z6AWAMMZY4V')).toBe(true)
        expect(payments.map((payment) => payment.amountMoney.amount)).toEqual(giftCardId ? [400n, 1100n] : [1500n])
        expect(mocks.payOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: 'order-id',
                paymentIds: giftCardId ? ['card-payment', 'gift-payment'] : ['card-payment'],
            })
        )
    })

    it('sends Werribee confirmation with the canonical Harpley address', async () => {
        const appointment: AcuityTypes.Api.Appointment = {
            id: 1,
            email: 'parent@example.com',
            firstName: 'Parent',
            lastName: 'Example',
            phone: '0400000000',
            appointmentTypeID: AcuityConstants.AppointmentTypes.WERRIBEE_OPENING,
            classID: 120414493,
            type: 'Fizz Kidz Werribee Opening Day',
            price: '15.00',
            forms: [],
            notes: '',
            calendarID: AcuityConstants.StoreCalendars.werribee,
            calendar: 'Werribee Studio',
            paid: 'yes',
            location: 'Shop T5, Harpley Town Center, Ison Rd, Werribee VIC 3030',
            datetime: '2026-09-19T10:00:00+10:00',
            confirmationPage: 'https://example.com/confirmation',
            certificate: '',
            duration: '60',
        }

        await sendConfirmationEmail([appointment], undefined)

        expect(mocks.sendEmail).toHaveBeenCalledWith('werribeeOpeningConfirmation', 'parent@example.com', {
            parentName: 'Parent',
            location: 'Fizz Kidz Werribee Studio',
            address: 'T5, Harpley Town Center, Bradfield St, Werribee VIC 3030',
            bookings: [
                {
                    datetime: expect.stringContaining('10:00'),
                    confirmationPage: 'https://example.com/confirmation',
                },
            ],
        })
    })
})
