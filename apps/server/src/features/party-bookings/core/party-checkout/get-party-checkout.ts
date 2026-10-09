import {
    getPartyPriceList,
    getSquareLocationId,
    MIN_CHARGED_CHILDREN,
    type Booking,
    type ChargedPartyLength,
    type PartyFormV2Addition,
    withoutSquareTags,
} from '@fizz-kidz/core'

import { getPartyFormV2Additions } from '../party-form-v2/options/get-party-form-v2-additions'

import { env } from '@/app/init/firebase'
import { canUseTerminalCheckout } from '@/features/payments/core/terminal-checkout-access'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { getCatalogItemOptions, isSoldAtLocation } from '@/integrations/square/core/get-catalog-item-options'

export type PartyPriceOption = {
    partyLength: ChargedPartyLength
    includesFood: boolean
    name: string
    /** Per child. */
    priceCents: number
    imageUrl: string | null
}

/**
 * What the checkout offers for a booking, priced by Square: the party price per child for each length and food
 * package, and the studio's food additions. `blocked` explains why a booking can't be charged here.
 */
export async function getPartyCheckout(bookingId: string, uid: string) {
    const booking = await DatabaseClient.getPartyBooking(bookingId)
    const blocked = await getBlockedReason(booking, uid)
    if (blocked) return { blocked, payment: booking.payment ?? null } as const

    const locationId = getSquareLocationId(env === 'prod' ? booking.location : 'test')
    const priceList = getPartyPriceList(env, booking.oldPrices)
    const [{ variations }, additions] = await Promise.all([
        getCatalogItemOptions(priceList.itemId),
        getPartyFormV2Additions(booking.location),
    ])

    const partyPrices: PartyPriceOption[] = []
    for (const partyLength of ['1.5', '2'] as const) {
        for (const includesFood of [true, false]) {
            const variationId = priceList.variations[partyLength][includesFood ? 'food' : 'noFood']
            const variation = variations.find((it) => it.id === variationId)
            if (!variation || !isSoldAtLocation(variation, locationId)) {
                return {
                    blocked: booking.oldPrices
                        ? "This party is on old prices, and the old prices aren't sold at this studio in Square."
                        : "This party's price isn't sold at this studio in Square.",
                    payment: null,
                } as const
            }
            const override = variation.locationOverrides.find((it) => it.locationId === locationId)
            partyPrices.push({
                partyLength,
                includesFood,
                name: withoutSquareTags(variation.name),
                priceCents: override?.priceCents ?? variation.priceCents,
                imageUrl: variation.imageUrl,
            })
        }
    }

    const offered = additions.filter((addition) => addition.variationId && addition.priceCents !== null)
    return {
        blocked: null,
        payment: null,
        customerEmail: booking.parentEmail,
        minChildren: MIN_CHARGED_CHILDREN,
        bookedChildren: booking.numberOfChildren,
        partyPrices,
        additions: offered.map(({ key, name, description, imageUrl, priceCents }) => ({
            key,
            name,
            description,
            imageUrl,
            priceCents: priceCents ?? 0,
        })),
        prefill: {
            partyLength: (booking.partyLength === '2' ? '2' : '1.5') as ChargedPartyLength,
            includesFood: booking.includesFood,
            childrenCount: getBookedChildren(booking.numberOfChildren),
            additions: offered
                .map((addition) => addition.key)
                .filter((key): key is PartyFormV2Addition => booking[key] === true),
        },
    } as const
}

/** Why staff (`uid`) can't charge a booking, if they can't. */
export async function getBlockedReason(booking: Pick<Booking, 'payment' | 'type' | 'location'>, uid: string) {
    if (booking.payment) return 'This party has already been paid.'
    if (booking.type !== 'studio') return 'Only studio parties can be charged at the studio.'
    if (!(await canUseTerminalCheckout(booking.location, uid)))
        return "Party checkout isn't available at this studio yet."
    return null
}

/** The party form records children as a range such as '16 - 20'; its lower end is the starting point. */
function getBookedChildren(numberOfChildren: string) {
    const booked = parseInt(numberOfChildren, 10)
    return Number.isFinite(booked) ? Math.max(booked, MIN_CHARGED_CHILDREN) : MIN_CHARGED_CHILDREN
}
