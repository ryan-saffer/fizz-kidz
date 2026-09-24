import { logger } from 'firebase-functions/v2'

import {
    AcuityConstants,
    AcuityUtilities,
    getHolidayProgramChangeEligibility,
    HOLIDAY_PROGRAM_POLICY,
} from '@fizz-kidz/core'

import { formatHolidayProgramAppointment } from './send-confirmation-email'

import type { AcuityWebhookData } from '@/integrations/acuity/functions/acuity.webhook'
import type { Square } from 'square'

import { AcuityClient } from '@/integrations/acuity/acuity.client'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { SquareClient } from '@/integrations/square/square.client'

export async function processHolidayProgramRefund(data: AcuityWebhookData) {
    const acuity = await AcuityClient.getInstance()
    const appointment = await acuity.getAppointment(data.id)

    const orderId = AcuityUtilities.retrieveFormAndField(
        appointment,
        AcuityConstants.Forms.PAYMENT,
        AcuityConstants.FormFields.ORDER_ID
    ) as string

    const square = await SquareClient.getInstance()
    let order: Square.Order

    try {
        const result = await square.orders.get({ orderId })
        order = result.order!
    } catch (err) {
        logError(
            `Unable to find square order while processing holiday program refund for session with classId: ${data.id}`,
            err,
            {
                webhookData: data,
            }
        )
        return
    }
    // if searching for line items that just match classId, multiple line items could be found if multiple children booked.
    // so to be sure we are processing the refund on the correct line item, we get the line item identifier
    const lineItemIdentifier =
        AcuityUtilities.retrieveFormAndField(
            appointment,
            AcuityConstants.Forms.PAYMENT,
            AcuityConstants.FormFields.LINE_ITEM_IDENTIFIER
        ) || 'not-found'
    const lineItemToRefund = order?.lineItems?.find((it) => it?.metadata?.['lineItemIdentifier'] === lineItemIdentifier)
    if (!lineItemToRefund) {
        logError(
            `Unable to find line item with matching class id and line item identifier for holiday program booking with id: ${appointment.id}`,
            null,
            { webhookData: data, lineItemIdentifier, orderId }
        )
        return
    }

    const mailClient = await MailClient.getInstance()

    let amountToRefund = lineItemToRefund.totalMoney?.amount

    // refunds follow the same 48 hour cutoff as rescheduling
    if (!getHolidayProgramChangeEligibility(appointment.datetime).canReschedule) {
        logger.log('Less than 48 hours before program, not performing refund.')
        await mailClient.sendEmail('holidayProgramCancellation', appointment.email, {
            booking: formatHolidayProgramAppointment(appointment),
            location: `Fizz Kidz ${appointment.calendar}`,
            parentName: appointment.firstName,
            receiptUrl: '',
            policy: HOLIDAY_PROGRAM_POLICY,
        })
        return
    }

    if (!amountToRefund || amountToRefund === BigInt(0)) {
        // dont process refunds on free bookings
        await mailClient.sendEmail('holidayProgramCancellation', appointment.email, {
            booking: formatHolidayProgramAppointment(appointment),
            location: `Fizz Kidz ${appointment.calendar}`,
            parentName: appointment.firstName,
            receiptUrl: '',
            policy: HOLIDAY_PROGRAM_POLICY,
        })
        return
    }

    let receiptUrl = ''
    let lastRefundPaymentId = ''

    if (!order.tenders || order.tenders.length === 0) {
        logError('Order does not have any tenders while processing holiday program refund', null, {
            webhookData: data,
            orderId: orderId,
        })
    } else {
        for (const tender of order.tenders) {
            if (amountToRefund <= BigInt(0)) {
                break
            }

            // determine remaining refundable amount on this tender (subtract any prior refunds)
            let refundableAmount = tender.amountMoney?.amount ?? BigInt(0)
            try {
                if (tender.paymentId) {
                    const { payment } = await square.payments.get({ paymentId: tender.paymentId })
                    const alreadyRefunded = payment?.refundedMoney?.amount ?? BigInt(0)
                    refundableAmount = refundableAmount - alreadyRefunded
                }
            } catch (error) {
                logError('Error determining refundable amount for tender during holiday program refund', error, {
                    webhookData: data,
                    orderId,
                    tenderId: tender.id,
                    paymentId: tender.paymentId,
                })
            }

            if (refundableAmount <= BigInt(0)) {
                continue
            }

            const refundThisTender = amountToRefund > refundableAmount ? refundableAmount : amountToRefund

            if (refundThisTender <= BigInt(0)) {
                continue
            }

            await square.refunds.refundPayment({
                idempotencyKey: `${data.id}-refund-${tender.id!}`,
                amountMoney: { amount: refundThisTender, currency: tender.amountMoney?.currency || 'AUD' },
                paymentId: tender.paymentId!,
                reason: 'Cancelled more than 48 hours before program - automatic refund',
            })
            lastRefundPaymentId = tender.paymentId!
            amountToRefund -= refundThisTender
        }

        if (amountToRefund > BigInt(0)) {
            logError('Refund amount not fully covered by tenders while processing holiday program refund', null, {
                webhookData: data,
                orderId,
                remainingAmount: amountToRefund.toString(),
            })
        }

        if (!lastRefundPaymentId) {
            logError('could not find a payment id while processing holiday program refund', null, {
                webhookData: data,
                orderId: orderId,
            })
        } else {
            try {
                const { payment } = await square.payments.get({ paymentId: lastRefundPaymentId })
                receiptUrl = payment?.receiptUrl || ''
            } catch (error) {
                logError('Error getting payment receipt while processing holiday program refund', error, {
                    data,
                    paymentId: lastRefundPaymentId,
                    appointment,
                })
            }
        }
    }

    await mailClient.sendEmail('holidayProgramCancellation', appointment.email, {
        booking: formatHolidayProgramAppointment(appointment),
        location: `Fizz Kidz ${appointment.calendar}`,
        parentName: appointment.firstName,
        receiptUrl,
        policy: HOLIDAY_PROGRAM_POLICY,
    })
}
