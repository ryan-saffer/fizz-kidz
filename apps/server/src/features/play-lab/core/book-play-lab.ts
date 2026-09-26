import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { Status } from 'google-gax'
import { DateTime } from 'luxon'

import { AcuityConstants, AcuityUtilities, normalize, studioNameAndAddress, type AcuityTypes } from '@fizz-kidz/core'

import { processPaylabPayment } from './process-play-lab-payment'

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
import { ZohoClient } from '@/integrations/zoho/zoho.client'

export type BookPlayLabProps = {
    idempotencyKey: string
    bookingType: 'term-booking' | 'casual'
    classes: AcuityTypes.Api.Class[]
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
        dob: string // ISO
        hasAllergies: boolean
        allergies?: string
        additionalInfo?: string
    }[]
    joinMailingList: boolean
    reference: 'google' | 'instagram' | 'word-of-mouth' | 'attended-fizz' | 'other'
    referenceOther: string | undefined
    payment: {
        token: string
        buyerVerificationToken: string
        giftCardId: string
        locationId: string
        amount: number // in cents
        lineItems: {
            // in order to access lineItemIdentifier when booking into acuity, all this information must be added at the line item level
            name: string
            amount: number // in cents
            quantity: string
            classId: number
            lineItemIdentifier: string // line item identifier needed for refunds, to ensure the correct line item is refunded
            appointmentTypeID: number
            className: string
            time: string
            duration: number
            calendarID: number
            childFirstName: string
            childLastName: string
            childDob: string
            childAllergies: string
            childAdditionalInfo: string
            emergencyContactName: string
            emergencyContactPhone: string
            emergencyContactRelation: string
        }[]
        discount:
            | ({ type: 'price' | 'percentage'; amount: number; name: string } & ( // percentage amount in format '7.25' for 7.25%
                  | { isMultiSessionDiscount: true }
                  | { isMultiSessionDiscount: false; code: string }
              )) // if not a multi session discount, then provide the exact discount code
            | null
    }
}

export async function bookPlayLab(input: BookPlayLabProps) {
    // MARK: Verify idempotency key
    try {
        await DatabaseClient.createPaymentIdempotencyKey(input.idempotencyKey)
    } catch (e: any) {
        if (e.code === Status.ALREADY_EXISTS) {
            // already run this function for this payment. perhaps a double click.. (has happened before)
            // end early.
            logger.warn('duplicate idempotency key during play lab booking', { input })
            return
        }
        throwTrpcError('INTERNAL_SERVER_ERROR', 'unable to create payment idempotency key for holiday program', e, {
            input,
        })
    }

    // MARK: Verify enough spots
    const acuity = await AcuityClient.getInstance()

    const uniqueAppointmentTypeIDs = [...new Set(input.classes.map((c) => c.appointmentTypeID))]

    const latestClasses = await acuity.getClasses(uniqueAppointmentTypeIDs, true, Date.now())

    input.classes.forEach((klass) => {
        const matchingClass = latestClasses.find((it) => it.id === klass.id)
        if (!matchingClass) {
            throwTrpcError(
                'UNPROCESSABLE_CONTENT',
                `could not find matching class in acuity for class with id: ${klass.id}`
            )
        }
        if (matchingClass.slotsAvailable < input.children.length) {
            throwCustomTrpcError(new ClassFullError("One of the selected play lab classes does not have enough spots'"))
        }
    })

    // all classes have enough spots! let's continue

    // MARK: Process payment
    const customerId = await getOrCreateCustomer(input.parentFirstName, input.parentLastName, input.parentEmail)

    const { paymentReceipt, order } = await processPaylabPayment(
        input.idempotencyKey,
        input.payment,
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
        throwTrpcError('INTERNAL_SERVER_ERROR', 'error processing play lab transaction', err, { input })
    })

    // MARK: Schedule into acuity
    const schedulingPromises = input.payment.lineItems.map((line) =>
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
                    value: `${line.childFirstName} ${line.childLastName}`,
                },
                {
                    id: AcuityConstants.FormFields.CHILDREN_AGES,
                    // convert ISO string to age
                    value: Math.floor(DateTime.now().diff(DateTime.fromISO(line.childDob), 'years').years),
                },
                {
                    id: AcuityConstants.FormFields.CHILDREN_ALLERGIES,
                    value: line.childAllergies,
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
                    id: AcuityConstants.FormFields.IS_TERM_ENROLMENT,
                    value: input.bookingType === 'term-booking' ? 'yes' : '',
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

    const appointments = await Promise.all(schedulingPromises).catch((err) =>
        throwTrpcError('INTERNAL_SERVER_ERROR', 'there was an error scheduling play lab into acuity', err, { input })
    )

    // MARK: CRM
    const zohoClient = new ZohoClient()
    try {
        for (const child of input.children) {
            // cannot use `Promise.all()` here, since each child is added individually.
            // doing them concurrently writes each child into the same free slot, and overwrite each other.
            // the most ideal fix is to pass all children into the zoho client, and the client can handle multiple children at once..
            // but cbf for now.
            await zohoClient.addPlayLabContact({
                firstName: input.parentFirstName,
                email: input.parentEmail,
                studio: AcuityUtilities.getStudioByCalendarId(input.classes[0].calendarID),
                childName: child.firstName,
                childBirthdayISO: child.dob.split('T')[0],
                optOutOfMarketing: !input.joinMailingList,
            })
        }
    } catch (err) {
        logError(`unable to add play lab booking to zoho with parent email '${input.parentEmail}'`, err, { input })
    }

    // MARK: Confirmation email
    const mailClient = await MailClient.getInstance()
    await mailClient.sendEmail('playLabBookingConfirmation', input.parentEmail, {
        parentName: input.parentFirstName,
        location: studioNameAndAddress(AcuityUtilities.getStudioByCalendarId(input.classes[0].calendarID)),
        bookings: input.payment.lineItems
            .sort((a, b) => (DateTime.fromISO(a.time) > DateTime.fromISO(b.time) ? 1 : -1))
            .map((line) => {
                const startTime = DateTime.fromISO(line.time, { zone: 'Australia/Melbourne' })
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
                    time: `${startTime.toFormat('cccc, LLL dd, t')} - ${endTime.toFormat('t')}`,
                    details: `${line.childFirstName} - ${line.className}`,
                    confirmationPage: appointment?.confirmationPage || '',
                }
            }),
        isTermEnrolment: input.bookingType === 'term-booking',
        receiptUrl: paymentReceipt,
    })

    // MARK: Update discount code
    const discount = input.payment.discount
    if (discount && !discount.isMultiSessionDiscount) {
        try {
            await DatabaseClient.updateDiscountCode(discount.code, {
                numberOfUses: FieldValue.increment(1),
            })
        } catch (err) {
            logError('Error while updating discount code during play lab booking', err, {
                code: discount.code,
                input,
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
                bookingType: 'play-lab',
                amountCents: input.payment.amount,
                discountType: discount.type,
                discountAmount: discount.amount,
                appointmentIds: appointments.map((appointment) => appointment.id.toString()),
                idempotencyKey: input.idempotencyKey,
                usedAt: new Date(),
            })
        } catch (err) {
            logError('Error while recording discount code redemption during play lab booking', err, {
                code: discount.code,
                customerEmail: input.parentEmail,
            })
        }
    }

    // MARK: Tracking
    try {
        const location = AcuityUtilities.getStudioByCalendarId(input.classes[0].calendarID)
        const mixpanel = await MixpanelClient.getInstance()
        const uniqueProgramNames = [...new Set(input.classes.map((it) => it.name))]
        const uniqueChildAges = [
            ...new Set(
                input.children.map((child) => Math.abs(DateTime.fromISO(child.dob).diffNow('years').years).toFixed(0))
            ),
        ]
        await mixpanel.track('play-lab-booking', {
            distinct_id: input.parentEmail,
            bookingType: input.bookingType,
            appointmntTypeIds: uniqueAppointmentTypeIDs,
            programNames: uniqueProgramNames,
            location,
            amount: input.payment.amount,
            numberOfPrograms: input.classes.length,
            numberOfKids: input.children.length,
            childAges: uniqueChildAges,
            ...(discount && {
                discountAmount: discount.amount,
                discountType: discount.type,
            }),
            ...(discount && !discount.isMultiSessionDiscount && { discountCode: discount.code }),
            reference: input.reference,
            ...(input.reference === 'other' && input.referenceOther && { referenceOther: input.referenceOther }),
        })
    } catch (err) {
        logError(
            `unable to add mixpanel event for play lab booking for customer with email '${input.parentEmail}'`,
            err,
            { input }
        )
    }

    return
}
