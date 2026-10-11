import { createHash } from 'crypto'

import { getSquareLocationId, type PartyForm, type PartyFormCheckout, type PreparePartyForm } from '@fizz-kidz/core'

import { validatePartyForm } from './validate-party-form'

import { env } from '@/app/init/firebase'
import { prepareCheckout } from '@/features/payments/core/prepare-checkout'

/**
 * Validates the answers and prepares a checkout (see `features/payments`) for anything paid now. Nothing is saved yet:
 * submit sends the answers again, and they must match the hash kept on the checkout's Square order.
 */
export async function preparePartyForm({
    payload,
    discountCode,
    giftCardNumber,
}: PreparePartyForm): Promise<PartyFormCheckout> {
    const { booking, lineItems, discounts } = await validatePartyForm(payload)
    const locationId = getSquareLocationId(env === 'prod' ? booking.location : 'test')
    // Food is charged at the end of the party, so answers without a cake or goodies have nothing to pay now.
    if (lineItems.length === 0)
        return {
            checkoutId: null,
            locationId,
            customerEmail: booking.parentEmail,
            subtotalCents: 0,
            discountCents: 0,
            discountCode: '',
            orderDiscountCents: 0,
            totalCents: 0,
            giftCardCents: 0,
            giftCardLast4: '',
            cardCents: 0,
            items: [],
        }
    const customer = payload.mode === 'party' ? payload : booking
    return prepareCheckout({
        program: 'party-form',
        sourceName: 'Party Form',
        locationId,
        customer: {
            firstName: customer.parentFirstName,
            lastName: customer.parentLastName,
            email: booking.parentEmail,
        },
        lineItems,
        discounts,
        metadata: getCheckoutMetadata(payload),
        discountCode,
        giftCardNumber,
    })
}

/** Ties a checkout to the booking and the exact answers it was prepared for. */
export function getCheckoutMetadata(payload: PartyForm) {
    return {
        bookingId: payload.bookingId,
        answersHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    }
}
