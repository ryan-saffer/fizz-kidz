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

function makeBookingInput(eventStudio: 'werribee' | 'malvern', giftCardId: string): HolidayProgramBookingProps {
    const calendarId = AcuityConstants.StoreCalendars[eventStudio]
    const studio = AcuityUtilities.getStudioByCalendarId(calendarId)

    return {
        idempotencyKey: `${studio}-order`,
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
                    appointmentTypeId: AcuityConstants.AppointmentTypes.OPEN_DAY,
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

describe.each([
    {
        studio: 'werribee',
        location: 'Fizz Kidz Werribee Studio',
        squareLocationId: 'L5Z6AWAMMZY4V',
        email: 'werribeeOpeningConfirmation',
        address: 'T5, Harpley Town Center, Bradfield St, Werribee VIC 3030',
        date: '2026-09-19',
    },
    {
        studio: 'malvern',
        location: 'Fizz Kidz Malvern Studio',
        squareLocationId: 'NSS38M5PEET6N',
        email: 'malvernCommunityDayConfirmation',
        address: '20 Glenferrie Rd, Malvern VIC 3144',
        date: '2026-09-26',
    },
] as const)('$studio event booking', ({ studio, location, squareLocationId, email, address, date }) => {
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

    it.each(['', 'gift-card-id'])('routes checkout to the booked studio with gift card "%s"', async (giftCardId) => {
        await processHolidayProgramPayment(makeBookingInput(studio, giftCardId))

        expect(mocks.createOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                order: expect.objectContaining({ locationId: squareLocationId }),
            })
        )
        const payments = mocks.createPayment.mock.calls.map(([payment]) => payment)
        expect(payments).toHaveLength(giftCardId ? 2 : 1)
        expect(payments.every((payment) => payment.locationId === squareLocationId)).toBe(true)
        expect(payments.map((payment) => payment.amountMoney.amount)).toEqual(giftCardId ? [400n, 1100n] : [1500n])
        expect(mocks.payOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: 'order-id',
                paymentIds: giftCardId ? ['card-payment', 'gift-payment'] : ['card-payment'],
            })
        )
    })

    it('selects the confirmation and canonical address by calendar ID for the shared appointment type', async () => {
        const appointment: AcuityTypes.Api.Appointment = {
            id: 1,
            email: 'parent@example.com',
            firstName: 'Parent',
            lastName: 'Example',
            phone: '0400000000',
            appointmentTypeID: AcuityConstants.AppointmentTypes.OPEN_DAY,
            classID: 120414493,
            type: 'Fizz Kidz Werribee Opening Day',
            price: '15.00',
            forms: [],
            notes: '',
            calendarID: AcuityConstants.StoreCalendars[studio],
            calendar: 'Werribee Studio',
            paid: 'yes',
            location: 'Shop T5, Harpley Town Center, Ison Rd, Werribee VIC 3030',
            datetime: `${date}T10:00:00+10:00`,
            confirmationPage: 'https://example.com/confirmation',
            certificate: '',
            duration: '60',
        }

        await sendConfirmationEmail([appointment], undefined)

        expect(mocks.sendEmail).toHaveBeenCalledWith(email, 'parent@example.com', {
            parentName: 'Parent',
            location,
            address,
            bookings: [
                {
                    datetime: expect.stringContaining(`Saturday, Sep ${date.slice(-2)}, 10:00`),
                    confirmationPage: 'https://example.com/confirmation',
                },
            ],
        })
    })
})
