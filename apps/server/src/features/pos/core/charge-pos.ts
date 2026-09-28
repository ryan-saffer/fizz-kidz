import type { PosTerminalCheckout, StartPos, TerminalCheckoutStatus } from '@fizz-kidz/core'

import { getBlockedReason } from './get-pos'
import { getPosMetadata } from './prepare-pos'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import {
    cancelTerminalPayment,
    getTerminalPayment,
    startTerminalPayment,
} from '@/features/payments/core/terminal-payment'

/** Sends a prepared sale to the studio's terminal, which offers the customer a receipt once they've paid. */
export async function startPos(input: StartPos, uid: string): Promise<TerminalCheckoutStatus> {
    const blocked = await getBlockedReason(input.studio, uid)
    if (blocked) throwTrpcError('BAD_REQUEST', blocked)
    return startTerminalPayment({
        checkoutId: input.checkoutId,
        deviceId: input.deviceId,
        note: 'Product sale',
        metadata: getPosMetadata(input.studio),
        receiptScreen: true,
    })
}

/** Where a sale is up to on the terminal. Square keeps the sale; nothing is stored in our database. */
export function getPosStatus(input: PosTerminalCheckout): Promise<TerminalCheckoutStatus> {
    return getTerminalPayment({
        checkoutId: input.checkoutId,
        terminalCheckoutId: input.terminalCheckoutId,
        metadata: getPosMetadata(input.studio),
    })
}

export async function cancelPos(input: PosTerminalCheckout) {
    await cancelTerminalPayment(input.terminalCheckoutId)
}
