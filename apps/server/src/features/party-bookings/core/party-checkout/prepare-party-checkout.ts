import {
    getPartyBirthdayChildDisplay,
    getPartyPriceList,
    getSquareLocationId,
    MIN_CHARGED_CHILDREN,
    type PartyCheckoutSummary,
    type PreparePartyCheckout,
} from '@fizz-kidz/core'

import { getPartyFormV2Additions } from '../party-form-v2/options/get-party-form-v2-additions'
import { getBlockedReason } from './get-party-checkout'

import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { prepareCheckout } from '@/features/payments/core/prepare-checkout'
import { DatabaseClient } from '@/integrations/firebase/database.client'

/**
 * Prices what staff are about to charge in Square and creates the unpaid order (see `features/payments`): the party
 * price per child for the children who came (at least the minimum), one of each food addition, the staff discount and
 * gift card. The order's metadata ties it to the booking.
 */
export async function preparePartyCheckout(input: PreparePartyCheckout): Promise<PartyCheckoutSummary> {
    const booking = await DatabaseClient.getPartyBooking(input.bookingId)
    const blocked = getBlockedReason(booking)
    if (blocked) throwTrpcError('BAD_REQUEST', blocked)

    const priceList = getPartyPriceList(env, booking.oldPrices)
    const chargedChildren = Math.max(input.childrenCount, MIN_CHARGED_CHILDREN)
    const additions = input.additions.length > 0 ? await getPartyFormV2Additions(booking.location) : []

    const lineItems: Square.OrderLineItem[] = [
        {
            catalogObjectId: priceList.variations[input.partyLength][input.includesFood ? 'food' : 'noFood'],
            quantity: String(chargedChildren),
        },
        ...input.additions.map((key) => {
            const variationId = additions.find((addition) => addition.key === key)?.variationId
            if (!variationId) throwTrpcError('BAD_REQUEST', 'A food addition is no longer offered. Please start again.')
            return { catalogObjectId: variationId, quantity: '1' }
        }),
    ]

    return prepareCheckout({
        program: 'party-checkout',
        sourceName: 'Party Checkout',
        locationId: getSquareLocationId(env === 'prod' ? booking.location : 'test'),
        customer: { firstName: booking.parentFirstName, lastName: booking.parentLastName, email: booking.parentEmail },
        lineItems,
        orderDiscount: input.discountCents > 0 ? { name: 'Discount', cents: input.discountCents } : undefined,
        metadata: {
            ...getPartyCheckoutMetadata(input.bookingId, chargedChildren),
            ...(input.discountCents > 0 && { discountReason: input.discountReason }),
        },
        giftCardNumber: input.giftCardNumber,
    })
}

/** Ties a checkout to its booking, and remembers how many children were charged for the booking's record. */
export function getPartyCheckoutMetadata(bookingId: string, chargedChildren?: number) {
    return { bookingId, ...(chargedChildren && { chargedChildren: String(chargedChildren) }) }
}

export function getPartyCheckoutNote(booking: Parameters<typeof getPartyBirthdayChildDisplay>[0]) {
    return `${getPartyBirthdayChildDisplay(booking)} party`
}
