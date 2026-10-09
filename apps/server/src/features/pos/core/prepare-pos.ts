import { getSquareLocationId, type PreparePos, type Studio } from '@fizz-kidz/core'

import { getBlockedReason, getStudioProducts } from './get-pos'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { prepareCheckout } from '@/features/payments/core/prepare-checkout'

/**
 * Prices the chosen products in Square with the discount and gift card, and creates the unpaid order to charge on the
 * terminal. Only products the studio sells can be charged. A walk-in sale has no customer; the terminal offers them a
 * receipt instead.
 */
export async function preparePos(input: PreparePos, uid: string) {
    const blocked = await getBlockedReason(input.studio, uid)
    if (blocked) throwTrpcError('BAD_REQUEST', blocked)

    const products = await getStudioProducts(input.studio)
    if (input.items.some((item) => !products.some((product) => product.variationId === item.variationId)))
        throwTrpcError('BAD_REQUEST', 'A product is no longer sold at this studio. Please start again.')

    return prepareCheckout({
        program: 'pos',
        sourceName: 'Product Sale',
        locationId: getSquareLocationId(env === 'prod' ? input.studio : 'test'),
        lineItems: input.items.map((item) => ({ catalogObjectId: item.variationId, quantity: String(item.quantity) })),
        orderDiscount: input.discountCents > 0 ? { name: 'Discount', cents: input.discountCents } : undefined,
        metadata: {
            ...getPosMetadata(input.studio),
            ...(input.discountCents > 0 && { discountReason: input.discountReason }),
        },
        giftCardNumber: input.giftCardNumber,
    })
}

/** Ties a sale's order to the studio selling it. */
export function getPosMetadata(studio: Studio) {
    return { studio }
}
