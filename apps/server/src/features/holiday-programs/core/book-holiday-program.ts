import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { Status } from 'google-gax'
import { DateTime } from 'luxon'

import type { DiscountCode, StudioOrTest } from '@fizz-kidz/core'
import { AcuityConstants, AcuityUtilities, formatHolidayProgramMedicalDetails, normalize } from '@fizz-kidz/core'

import { getDiscountCodeRedemptionKey } from './discount-codes/check-discount-code'
import { prepareMedicalPlans } from './prepare-medical-plans'
import { processHolidayProgramPayment } from './process-holiday-program-payment'
import { sendConfirmationEmail } from './send-confirmation-email'

import { throwCustomTrpcError, throwTrpcError } from '@/app/trpc/transport-errors'
import { ClassFullError } from '@/app/trpc/trpc.errors'
import { AcuityClient } from '@/integrations/acuity/acuity.client'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { SheetsClient } from '@/integrations/google/sheets.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'
import { ZohoClient } from '@/integrations/zoho/zoho.client'

export type HolidayProgramBookingProps = {
    idempotencyKey: string
    parentFirstName: string
    parentLastName: string
    parentEmail: string
    parentPhone: string
    emergencyContactName: string
    emergencyContactPhone: string
    joinMailingList: boolean
    numberOfKids: number
    payment: {
        token: string
        buyerVerificationToken: string
        giftCardId: string
        amount: number // in cents
        locationId: string
        lineItems: {
            name: string
            quantity: string
            amount: number // in cents
            classId: number
            lineItemIdentifier: string
            appointmentTypeId: number
            time: string
            calendarId: number
            childName: string
            childDob: string // ISO
            childAllergies: string
            childIsAnaphylactic: boolean
            childAnaphylaxisPlan: string
            childRequiresAsthmaActionPlan?: boolean
            childAsthmaActionPlan?: string
            childAdditionalInfo: string
            isAllDayClass: boolean
            title?: string // eg. 'Swifty Spectacular'. For mixpanel.
            creations?: string[] // for mixpanel
        }[]
        discount: (DiscountCode & { description: string }) | null
    }
}

export type HolidayProgramBookingResult = {
    transactionId: string
    value: number
    currency: 'AUD'
    studio: StudioOrTest
}

export async function bookHolidayProgram(input: HolidayProgramBookingProps) {
    logger.info('❯ bookHolidayProgram start', { input }) // temporary while debugging 500 error
    try {
        const medicalPlanUrls = await prepareMedicalPlans(input.payment.lineItems)
        validatePaymentAmount(input)

        // MARK: Verify idempotency key
        try {
            await DatabaseClient.createPaymentIdempotencyKey(input.idempotencyKey)
        } catch (e: any) {
            if (e.code === Status.ALREADY_EXISTS) {
                // already run this function for this payment. perhaps a double click.. (has happened before)
                // end early.
                return getHolidayProgramBookingResult(input)
            }
            throwTrpcError('INTERNAL_SERVER_ERROR', 'unable to create payment idempotency key for holiday program', e, {
                input,
            })
        }

        // MARK: Verify enough spots
        const acuity = await AcuityClient.getInstance()
        const uniqueAppointmentTypeIds = [...new Set(input.payment.lineItems.map((it) => it.appointmentTypeId))]
        const latestClasses = await acuity.getClasses(uniqueAppointmentTypeIds, true, Date.now())

        for (const item of input.payment.lineItems) {
            const matchingClass = latestClasses.find((it) => it.id === item.classId)
            if (!matchingClass) {
                throwTrpcError(
                    'UNPROCESSABLE_CONTENT',
                    `could not find matching class in acuity for holiday program class with id: ${item.classId}`
                )
            }
            if (matchingClass.slotsAvailable < input.numberOfKids) {
                throwCustomTrpcError(
                    new ClassFullError('One of the selected holiday program classes does not have enought spots')
                )
            }
        }

        // all classes have enough spots! let's continue

        // MARK: Process payment
        const { orderId, recieptUrl, squarePaymentLink } = await processHolidayProgramPayment(input)

        // MARK: Schedule into acuity
        const appointments = await Promise.all(
            input.payment.lineItems.map((item) =>
                acuity.scheduleAppointment({
                    appointmentTypeID: item.appointmentTypeId,
                    datetime: item.time,
                    calendarID: item.calendarId,
                    firstName: input.parentFirstName,
                    lastName: input.parentLastName,
                    email: input.parentEmail,
                    phone: input.parentPhone,
                    certificate: item.isAllDayClass ? 'allday' : undefined,
                    paid: true,
                    fields: [
                        {
                            id: AcuityConstants.FormFields.CHILDREN_NAMES,
                            value: item.childName,
                        },
                        {
                            id: AcuityConstants.FormFields.CHILDREN_AGES,
                            // convert ISO string to age
                            value: Math.floor(
                                DateTime.fromISO(item.time).diff(DateTime.fromISO(item.childDob), 'years').years
                            ),
                        },
                        {
                            id: AcuityConstants.FormFields.CHILDREN_ALLERGIES,
                            value: formatHolidayProgramMedicalDetails({
                                allergies: item.childAllergies,
                                isAnaphylactic: item.childIsAnaphylactic,
                                anaphylaxisPlan: medicalPlanUrls.get(item.childAnaphylaxisPlan) || '',
                                requiresAsthmaActionPlan: item.childRequiresAsthmaActionPlan === true,
                                asthmaActionPlan: medicalPlanUrls.get(item.childAsthmaActionPlan || '') || '',
                            }),
                        },
                        {
                            id: AcuityConstants.FormFields.CHILD_ADDITIONAL_INFO,
                            value: item.childAdditionalInfo,
                        },
                        {
                            id: AcuityConstants.FormFields.EMERGENCY_CONTACT_NAME_HP,
                            value: input.emergencyContactName,
                        },
                        {
                            id: AcuityConstants.FormFields.EMERGENCY_CONTACT_NUMBER_HP,
                            value: input.emergencyContactPhone,
                        },
                        {
                            id: AcuityConstants.FormFields.ORDER_ID,
                            value: orderId,
                        },
                        {
                            id: AcuityConstants.FormFields.LINE_ITEM_IDENTIFIER,
                            value: item.lineItemIdentifier,
                        },
                    ],
                })
            )
        ).catch((error) =>
            throwTrpcError('INTERNAL_SERVER_ERROR', 'There was an error booking a holiday program into acuity', error, {
                input,
                orderId: orderId,
            })
        )

        const firstProgram = [...input.payment.lineItems].sort((a, b) => (a.time < b.time ? -1 : 1))[0]

        // MARK: CRM
        const zoho = new ZohoClient()
        try {
            await zoho.addHolidayProgramBookingToDeal({
                firstName: input.parentFirstName,
                lastName: input.parentLastName,
                email: input.parentEmail,
                mobile: input.parentPhone,
                optOutOfMarketing: !input.joinMailingList,
                rows: input.payment.lineItems.map((line, index) => ({
                    appointmentId: appointments[index].id,
                    dateTimeISO: line.time,
                    studio: AcuityUtilities.getStudioByCalendarId(line.calendarId),
                    childName: line.childName,
                    childBirthdayISO: line.childDob,
                    bookingUrl: appointments[index].confirmationPage,
                    squarePaymentLink,
                })),
            })
        } catch (err) {
            logError(`unable to add holiday program booking to zoho with parent email: ${input.parentEmail}`, err, {
                input,
            })
        }

        // MARK: Additional needs spreadsheet
        // write additional info to spreadsheet to contact parent
        const additionaNeedsLineItems = input.payment.lineItems.filter((it) => it.childAdditionalInfo !== '')

        try {
            if (additionaNeedsLineItems.length > 0) {
                const sheetsClient = await SheetsClient.getInstance()
                await sheetsClient.addRowToSheet(
                    'holidayProgramAdditionalNeeds',
                    additionaNeedsLineItems.map((item) => [
                        appointments[0].calendar,
                        item.time,
                        input.parentFirstName,
                        input.parentLastName,
                        input.parentEmail,
                        input.parentPhone,
                        item.childName,
                        Math.abs(DateTime.fromISO(item.childDob).diffNow('years').years).toFixed(0),
                        item.childAllergies,
                        item.childAdditionalInfo,
                    ]),
                    'Additional Needs'
                )
            }
        } catch (err) {
            logError(`Error writing to holiday program additional needs spreadsheet`, err, { input })
        }

        // MARK: Cconfirmation email
        await sendConfirmationEmail(appointments, recieptUrl)

        // MARK: Discount code
        // if using a discount code, update its number of uses
        const discount = input.payment.discount
        if (discount) {
            try {
                await DatabaseClient.updateDiscountCode(discount.code, { numberOfUses: FieldValue.increment(1) })
            } catch (err) {
                logError('Error while updating discount code during holiday program registration', err, {
                    code: discount.code,
                })
            }

            try {
                await DatabaseClient.createDiscountCodeRedemption({
                    code: discount.code,
                    normalizedCode: normalize(discount.code),
                    customerEmail: input.parentEmail,
                    normalizedCustomerEmail: normalize(input.parentEmail),
                    redemptionKey: getDiscountCodeRedemptionKey(discount.code, input.parentEmail),
                    customerName: `${input.parentFirstName} ${input.parentLastName}`.trim(),
                    bookingType: 'holiday-program',
                    amountCents: input.payment.amount,
                    discountType: discount.discountType,
                    discountAmount: discount.discountAmount,
                    appointmentIds: appointments.map((appointment) => appointment.id.toString()),
                    idempotencyKey: input.idempotencyKey,
                    usedAt: new Date(),
                })
            } catch (err) {
                logError('Error while recording discount code redemption during holiday program registration', err, {
                    code: discount.code,
                    customerEmail: input.parentEmail,
                })
            }
        }

        // MARK: Tracking
        const location = AcuityUtilities.getStudioByCalendarId(firstProgram.calendarId)
        const mixpanel = await MixpanelClient.getInstance()

        const uniqueChildNamesCount = new Set(input.payment.lineItems.map((b) => b.childName)).size

        const childAgesSet = new Set(
            input.payment.lineItems.map((item) =>
                Math.abs(DateTime.fromISO(item.childDob).diffNow('years').years).toFixed(0)
            )
        )
        const titlesSet = new Set(input.payment.lineItems.map((item) => item.title).filter((it) => it !== undefined))
        const creationsSet = new Set(
            input.payment.lineItems.reduce(
                (acc, item) => [...acc, ...(item.creations ? item.creations : [])],
                [] as string[]
            )
        )

        const childAges = [...childAgesSet]
        const titles = [...titlesSet]
        const creations = [...creationsSet]

        await mixpanel.track('holiday-program-booking', {
            distinct_id: input.parentEmail,
            location,
            amount: input.payment.amount / 100,
            numberOfSlots: input.payment.lineItems.length,
            numberOfKids: uniqueChildNamesCount,
            childAges,
            ...(discount && { discountCode: discount.code }),
            ...(titles.length && { titles }),
            ...(creations.length && { creations }),
        })

        logger.info('✓ bookHolidayProgram completed successfully', {
            idempotencyKey: input.idempotencyKey,
        })

        return getHolidayProgramBookingResult(input)
    } catch (err) {
        console.error('✗ bookHolidayProgram failed:', err)
        throw err
    }
}

function getHolidayProgramBookingResult(input: HolidayProgramBookingProps): HolidayProgramBookingResult {
    const firstProgram = [...input.payment.lineItems].sort((a, b) => (a.time < b.time ? -1 : 1))[0]!

    return {
        transactionId: input.idempotencyKey,
        value: input.payment.amount / 100,
        currency: 'AUD',
        studio: AcuityUtilities.getStudioByCalendarId(firstProgram.calendarId),
    }
}

function validatePaymentAmount(input: HolidayProgramBookingProps) {
    const expectedAmount = calculateExpectedPaymentAmount(input)

    if (expectedAmount < 0) {
        throwTrpcError('BAD_REQUEST', 'holiday program discount amount exceeds booking total')
    }

    if (input.payment.amount !== expectedAmount) {
        throwTrpcError(
            'BAD_REQUEST',
            `holiday program payment amount mismatch: expected ${expectedAmount}, received ${input.payment.amount}`
        )
    }
}

function calculateExpectedPaymentAmount(input: HolidayProgramBookingProps) {
    const subtotal = input.payment.lineItems.reduce((total, item) => total + item.amount, 0)

    if (!input.payment.discount) {
        return subtotal
    }

    if (input.payment.discount.discountType === 'percentage') {
        return Math.round(subtotal * (1 - input.payment.discount.discountAmount / 100))
    }

    return subtotal - input.payment.discount.discountAmount
}
