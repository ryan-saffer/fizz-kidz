import type { PartyCheckoutStatus, PartyPayment, PartyTerminalCheckout, StartPartyCheckout } from '@fizz-kidz/core'

import { getBlockedReason } from './get-party-checkout'
import { getPartyCheckoutMetadata, getPartyCheckoutNote } from './prepare-party-checkout'
import { sendPartyPaymentReceipt } from './send-party-payment-receipt'
import { syncPartyPaymentToZoho } from './sync-party-payment-to-zoho'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { ORDER_DISCOUNT_UID, readCheckoutMetadata } from '@/features/payments/core/checkout-order'
import {
    cancelTerminalPayment,
    getTerminalPayment,
    startTerminalPayment,
    type TerminalPaymentResult,
} from '@/features/payments/core/terminal-payment'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { logError } from '@/integrations/observability/log-error'
import { SquareClient } from '@/integrations/square/square.client'

/** Sends a prepared party checkout to the studio's terminal. */
export async function startPartyCheckout(input: StartPartyCheckout): Promise<PartyCheckoutStatus> {
    const booking = await DatabaseClient.getPartyBooking(input.bookingId)
    const blocked = getBlockedReason(booking)
    if (blocked) throwTrpcError('BAD_REQUEST', blocked)

    const result = await startTerminalPayment({
        checkoutId: input.checkoutId,
        deviceId: input.deviceId,
        note: getPartyCheckoutNote(booking),
        metadata: getPartyCheckoutMetadata(input.bookingId),
    })
    return settle(input.bookingId, input.checkoutId, result)
}

/** Where a party charge is up to. Once paid, the payment is recorded on the booking and the parent emailed a receipt. */
export async function getPartyCheckoutStatus(input: PartyTerminalCheckout): Promise<PartyCheckoutStatus> {
    const result = await getTerminalPayment({
        checkoutId: input.checkoutId,
        terminalCheckoutId: input.terminalCheckoutId,
        metadata: getPartyCheckoutMetadata(input.bookingId),
    })
    return settle(input.bookingId, input.checkoutId, result)
}

export async function cancelPartyCheckout(input: PartyTerminalCheckout) {
    await cancelTerminalPayment(input.terminalCheckoutId)
}

async function settle(bookingId: string, checkoutId: string, result: TerminalPaymentResult) {
    if (result.status === 'paid') await recordPartyPayment(bookingId, checkoutId, result.receiptUrl)
    return result
}

/**
 * Records the payment on the booking once, however many times it's checked, then emails the receipt and adds the
 * payment to the party's Zoho deal.
 */
async function recordPartyPayment(bookingId: string, checkoutId: string, receiptUrl: string | null) {
    const booking = await DatabaseClient.getPartyBooking(bookingId)
    if (booking.payment?.squareOrderId === checkoutId) return

    const square = await SquareClient.getInstance()
    const { order } = await square.orders.get({ orderId: checkoutId })
    if (!order) throw new Error(`Paid party checkout order '${checkoutId}' not found`)
    const payment: PartyPayment = {
        squareOrderId: checkoutId,
        totalCents: Number(order.totalMoney?.amount ?? 0),
        giftCardCents: readCheckoutMetadata(order)?.giftCardCents ?? 0,
        discountCents: Number(
            order.discounts?.find((discount) => discount.uid === ORDER_DISCOUNT_UID)?.appliedMoney?.amount ?? 0
        ),
        ...(order.metadata?.discountReason && { discountReason: order.metadata.discountReason }),
        chargedChildren: Number(order.metadata?.chargedChildren ?? 0),
        receiptUrl,
        paidAt: new Date().toISOString(),
    }
    const result = await DatabaseClient.recordPartyPayment(bookingId, payment)
    // the webhook or the iPad recorded it first
    if (!result.recorded) return
    // two charges for the same party; both are in Square, but the booking keeps the latest
    if (result.replacedOrderId)
        logError('Party paid twice', undefined, {
            bookingId,
            recordedOrderId: result.replacedOrderId,
            newOrderId: checkoutId,
        })

    try {
        await sendPartyPaymentReceipt(booking, order, payment)
    } catch (error) {
        logError('Party payment collected, but unable to email the receipt', error, { bookingId, checkoutId })
    }
    try {
        await syncPartyPaymentToZoho(booking, order, payment)
    } catch (error) {
        logError('Party payment collected, but unable to add it to the Zoho deal', error, { bookingId, checkoutId })
    }
}
