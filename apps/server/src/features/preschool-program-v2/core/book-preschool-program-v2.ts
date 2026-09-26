import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { Status } from 'google-gax'
import { DateTime } from 'luxon'

import { AcuityConstants, AcuityUtilities, normalize, studioNameAndAddress } from '@fizz-kidz/core'
import type { AcuityTypes, DiscountCode } from '@fizz-kidz/core'

import { processPreschoolProgramV2Payment } from './process-preschool-program-v2-payment'

import { throwCustomTrpcError, throwTrpcError } from '@/app/trpc/transport-errors'
import { ClassFullError, CustomTrpcError, PaymentMethodInvalidError } from '@/app/trpc/trpc.errors'
import { getDiscountCodeRedemptionKey } from '@/features/discount-codes/core/check-discount-code'
import { AcuityClient } from '@/integrations/acuity/acuity.client'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { getOrCreateCustomer } from '@/integrations/square/core/get-or-create-customer'
import { getSquareError } from '@/integrations/square/square.client'

const TERM_LOOKBACK_MONTHS = 6
const TERM_BOUNDARY_GAP_DAYS = 14

export type BookPreschoolProgramV2Props = {
    idempotencyKey: string
    parentFirstName: string
    parentLastName: string
    parentPhone: string
    parentEmail: string
    emergencyContactName: string
    emergencyContactPhone: string
    emergencyContactRelation: string
    children: {
        firstName: string
        lastName: string
        dob: string
        hasAllergies: boolean
        allergies?: string
        isAnaphylactic: boolean
        anaphylaxisPlan?: {
            fileName: string
            storagePath: string
        }
        additionalInfo?: string
    }[]
    joinMailingList: boolean
    payment: {
        token: string
        buyerVerificationToken: string
        giftCardId: string
        locationId: string
        amount: number
        lineItems: PreschoolProgramV2LineItem[]
        discount: (DiscountCode & { description: string }) | null
    }
}

export type PreschoolProgramV2LineItem = {
    name: string
    amount: number
    classId: number
    lineItemIdentifier: string
    appointmentTypeID: number
    time: string
    duration: number
    calendarID: number
    childFirstName: string
    childLastName: string
    childDob: string
    childAllergies: string
    childIsAnaphylactic: boolean
    childAnaphylaxisPlanStoragePath: string
    childAdditionalInfo: string
    isFullTermDiscount: boolean
}

/** Validates, charges, schedules, records, and confirms one preschool-v2 checkout. */
export async function bookPreschoolProgramV2(input: BookPreschoolProgramV2Props) {
    try {
        await DatabaseClient.createPaymentIdempotencyKey(input.idempotencyKey)
    } catch (e: any) {
        if (e.code === Status.ALREADY_EXISTS) {
            logger.warn('duplicate idempotency key during preschool-v2 booking', { input })
            return
        }

        throwTrpcError('INTERNAL_SERVER_ERROR', 'unable to create payment idempotency key for preschool-v2', e, {
            input,
        })
    }

    const acuity = await AcuityClient.getInstance()
    const appointmentTypeIds = [...new Set(input.payment.lineItems.map((line) => line.appointmentTypeID))]
    const latestClasses = await acuity.getClasses(
        appointmentTypeIds,
        true,
        DateTime.now().minus({ months: TERM_LOOKBACK_MONTHS }).toMillis()
    )
    const selectedClassIds = new Set(input.payment.lineItems.map((line) => line.classId))

    const sanitizedLineItems = input.payment.lineItems.map((line): PreschoolProgramV2LineItem => {
        const matchingClass = latestClasses.find((klass) => klass.id === line.classId)
        if (!matchingClass) {
            throwTrpcError('UNPROCESSABLE_CONTENT', `could not find preschool-v2 class with id: ${line.classId}`)
        }

        if (matchingClass.slotsAvailable < input.children.length) {
            throwCustomTrpcError(new ClassFullError('One of the selected preschool sessions is full'))
        }

        const amount = Math.round(Number.parseFloat(matchingClass.price) * 100)
        const startTime = DateTime.fromISO(matchingClass.time, { setZone: true })
        const childName = `${line.childFirstName} ${line.childLastName}`.trim()

        return {
            ...line,
            name: `${childName} - Preschool Program - ${startTime.toFormat('cccc d LLLL, h:mm a')}`,
            amount,
            appointmentTypeID: matchingClass.appointmentTypeID,
            time: matchingClass.time,
            duration: matchingClass.duration,
            calendarID: matchingClass.calendarID,
            isFullTermDiscount: isClassFullTermDiscounted(matchingClass, latestClasses, selectedClassIds),
        }
    })

    const customerId = await getOrCreateCustomer(input.parentFirstName, input.parentLastName, input.parentEmail)

    const { order, paymentReceipt } = await processPreschoolProgramV2Payment(
        input.idempotencyKey,
        {
            ...input.payment,
            lineItems: sanitizedLineItems,
        },
        input.parentEmail,
        customerId
    ).catch(async (err: any) => {
        if (err.cause instanceof CustomTrpcError) {
            throw err
        }

        const squareError = await getSquareError(err)
        if (squareError) {
            const error = squareError.errors[0]
            if (error.category === 'PAYMENT_METHOD_ERROR') {
                throwCustomTrpcError(new PaymentMethodInvalidError())
            }
        }

        throwTrpcError('INTERNAL_SERVER_ERROR', 'error processing preschool-v2 transaction', err, { input })
    })

    const appointments = await Promise.all(
        sanitizedLineItems.map((line) =>
            acuity.scheduleAppointment({
                appointmentTypeID: line.appointmentTypeID,
                datetime: line.time,
                calendarID: line.calendarID,
                firstName: input.parentFirstName,
                lastName: input.parentLastName,
                email: input.parentEmail,
                phone: input.parentPhone,
                paid: true,
                fields: [
                    {
                        id: AcuityConstants.FormFields.CHILDREN_NAMES,
                        value: `${line.childFirstName} ${line.childLastName}`.trim(),
                    },
                    {
                        id: AcuityConstants.FormFields.CHILDREN_AGES,
                        value: Math.floor(
                            DateTime.fromISO(line.time).diff(DateTime.fromISO(line.childDob), 'years').years
                        ),
                    },
                    {
                        id: AcuityConstants.FormFields.CHILDREN_ALLERGIES,
                        value: formatChildAllergies(line),
                    },
                    {
                        id: AcuityConstants.FormFields.CHILD_ADDITIONAL_INFO,
                        value: line.childAdditionalInfo,
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
                        id: AcuityConstants.FormFields.EMERGENCY_CONTACT_RELATION_HP,
                        value: input.emergencyContactRelation,
                    },
                    {
                        id: AcuityConstants.FormFields.ORDER_ID,
                        value: order.id || '',
                    },
                    {
                        id: AcuityConstants.FormFields.LINE_ITEM_IDENTIFIER,
                        value: line.lineItemIdentifier,
                    },
                ],
            })
        )
    ).catch((err) =>
        throwTrpcError('INTERNAL_SERVER_ERROR', 'there was an error scheduling preschool-v2 into acuity', err, {
            input,
            orderId: order.id,
        })
    )

    try {
        await sendConfirmationEmail(input, sanitizedLineItems, appointments, paymentReceipt)
    } catch (err) {
        logError('preschool-v2 booked successfully, but unable to send confirmation email', err, {
            orderId: order.id,
            appointmentIds: appointments.map((appointment) => appointment.id),
        })
    }

    const discount = input.payment.discount
    if (discount) {
        try {
            await DatabaseClient.updateDiscountCode(discount.code, { numberOfUses: FieldValue.increment(1) })
        } catch (err) {
            logError('Error while updating discount code during preschool-v2 booking', err, { code: discount.code })
        }

        try {
            await DatabaseClient.createDiscountCodeRedemption({
                code: discount.code,
                normalizedCode: normalize(discount.code),
                customerEmail: input.parentEmail,
                normalizedCustomerEmail: normalize(input.parentEmail),
                redemptionKey: getDiscountCodeRedemptionKey(discount.code, input.parentEmail),
                customerName: `${input.parentFirstName} ${input.parentLastName}`.trim(),
                bookingType: 'preschool-program-v2',
                amountCents: input.payment.amount,
                discountType: discount.discountType,
                discountAmount: discount.discountAmount,
                appointmentIds: appointments.map((appointment) => appointment.id.toString()),
                idempotencyKey: input.idempotencyKey,
                usedAt: new Date(),
            })
        } catch (err) {
            logError('Error while recording discount code redemption during preschool-v2 booking', err, {
                code: discount.code,
                customerEmail: input.parentEmail,
            })
        }
    }

    const mixpanel = await MixpanelClient.getInstance()
    const childAges = [
        ...new Set(
            sanitizedLineItems.map((line) =>
                Math.abs(DateTime.fromISO(line.childDob).diffNow('years').years).toFixed(0)
            )
        ),
    ]

    await mixpanel.track('preschool-program-booking', {
        distinct_id: input.parentEmail,
        location: AcuityUtilities.getStudioByCalendarId(sanitizedLineItems[0].calendarID),
        amount: input.payment.amount / 100,
        numberOfSlots: sanitizedLineItems.length,
        numberOfKids: new Set(sanitizedLineItems.map((line) => `${line.childFirstName} ${line.childLastName}`)).size,
        childAges,
        ...(discount && { discountCode: discount.code }),
    })

    return {
        orderId: order.id || '',
        receiptUrl: paymentReceipt,
        appointmentIds: appointments.map((appointment) => appointment.id),
    }
}

/** Determines whether a class belongs to a fully selected, available term that has not started. */
function isClassFullTermDiscounted(
    klass: AcuityTypes.Api.Class,
    allClasses: AcuityTypes.Api.Class[],
    selectedClassIds: Set<number>
) {
    const termClasses = getTermClassesForClass(klass, allClasses)
    const firstClass = termClasses[0]

    return (
        termClasses.length > 0 &&
        DateTime.fromISO(firstClass.time, { setZone: true }).toMillis() > DateTime.now().toMillis() &&
        termClasses.every((candidate) => candidate.slotsAvailable > 0) &&
        termClasses.every((candidate) => selectedClassIds.has(candidate.id))
    )
}

/** Finds the inferred term block containing a class using weekday/time grouping and two-week boundaries. */
function getTermClassesForClass(klass: AcuityTypes.Api.Class, allClasses: AcuityTypes.Api.Class[]) {
    const groupKey = getClassGroupKey(klass)
    const groupClasses = allClasses
        .filter((candidate) => getClassGroupKey(candidate) === groupKey)
        .sort(
            (a, b) =>
                DateTime.fromISO(a.time, { setZone: true }).toMillis() -
                DateTime.fromISO(b.time, { setZone: true }).toMillis()
        )

    const terms: AcuityTypes.Api.Class[][] = []
    let currentTerm: AcuityTypes.Api.Class[] = []

    groupClasses.forEach((candidate) => {
        const previousClass = currentTerm.at(-1)
        const gapDays = previousClass
            ? DateTime.fromISO(candidate.time, { setZone: true }).diff(
                  DateTime.fromISO(previousClass.time, { setZone: true }),
                  'days'
              ).days
            : 0

        if (previousClass && gapDays >= TERM_BOUNDARY_GAP_DAYS) {
            terms.push(currentTerm)
            currentTerm = []
        }

        currentTerm.push(candidate)
    })

    if (currentTerm.length > 0) terms.push(currentTerm)

    return terms.find((term) => term.some((candidate) => candidate.id === klass.id)) ?? []
}

/** Builds a stable studio, weekday, and start-time key for an Acuity class. */
function getClassGroupKey(klass: AcuityTypes.Api.Class) {
    const start = DateTime.fromISO(klass.time, { setZone: true })
    return `${klass.calendarID}-${start.weekday}-${start.toFormat('HH:mm')}`
}

/** Formats allergy text and the private anaphylaxis storage path for Acuity. */
function formatChildAllergies(line: PreschoolProgramV2LineItem) {
    const parts = [line.childAllergies.trim()]

    if (line.childIsAnaphylactic && line.childAnaphylaxisPlanStoragePath) {
        parts.push(`Anaphylaxis plan: ${line.childAnaphylaxisPlanStoragePath}`)
    }

    return parts.filter(Boolean).join('\n\n')
}

/** Sends the paid-booking confirmation with session management links and receipt details. */
async function sendConfirmationEmail(
    input: BookPreschoolProgramV2Props,
    lineItems: PreschoolProgramV2LineItem[],
    appointments: AcuityTypes.Api.Appointment[],
    receiptUrl: string | undefined
) {
    const mailClient = await MailClient.getInstance()

    await mailClient.sendEmail('preschoolProgramV2BookingConfirmation', input.parentEmail, {
        parentName: input.parentFirstName,
        location: studioNameAndAddress(AcuityUtilities.getStudioByCalendarId(lineItems[0].calendarID)),
        bookings: lineItems
            .slice()
            .sort(
                (a, b) =>
                    DateTime.fromISO(a.time, { setZone: true }).toMillis() -
                    DateTime.fromISO(b.time, { setZone: true }).toMillis()
            )
            .map((line) => {
                const startTime = DateTime.fromISO(line.time, { setZone: true })
                const endTime = startTime.plus({ minutes: line.duration })
                const appointment = appointments.find(
                    (it) =>
                        AcuityUtilities.retrieveFormAndField(
                            it,
                            AcuityConstants.Forms.PAYMENT,
                            AcuityConstants.FormFields.LINE_ITEM_IDENTIFIER
                        ) === line.lineItemIdentifier
                )

                return {
                    time: `${startTime.toFormat('cccc, LLL dd, h:mm a')} - ${endTime.toFormat('h:mm a')}`,
                    details: `${line.childFirstName} ${line.childLastName}`.trim(),
                    confirmationPage: appointment?.confirmationPage || '',
                    isFullTermDiscount: line.isFullTermDiscount,
                }
            }),
        receiptUrl,
    })
}
