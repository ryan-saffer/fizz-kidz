import { isStockedPartyOrder } from '@fizz-kidz/core'
import type { Booking } from '@fizz-kidz/core'

import { getPartyFormCakeOptions } from '../party-form/options/get-party-form-cake-options'

import type { PartyFormCakeOption } from '../party-form/options/get-party-form-cake-options'

import { getCakeSuppliesByOption } from '@/features/inventory/core/inventory.cake-supplies'

/**
 * Studio-stock cakes (Geelong, Werribee) were paid for in the party form, so checkout doesn't charge for them. Staff
 * just confirm the party used the cake, and whether it was served in our cups and spoons and had our candles, before
 * they come off stock. The answers travel on the Square order, so the payment webhook settles stock the same way the
 * iPad does.
 */
const CAKE_USAGE_KEY = 'cakeUsage'

export type PartyCakeUsage = { cakeUsed: boolean; cakeServingUsed: boolean; cakeCandlesUsed: boolean }

/** A cake supply choice staff confirm: the Square option whose supplies are used, and whether the parent chose it. */
type SupplyChoice = { optionId: string; supplies: string[]; ordered: boolean }

/**
 * The serving (cups and spoons) and candle choices for a booking's cake. Each uses the option the parent chose if the
 * studio stocks its supplies, otherwise the first option it does (so staff can tick cups for a parent who chose to
 * bring their own bowls but used ours). `null` when the studio stocks no supplies for that choice.
 */
export async function getCakeSupplyChoices(booking: Booking) {
    if (!booking.cake) return { serving: null, candles: null }
    const [{ servingOptions, candleOptions }, supplies] = await Promise.all([
        getPartyFormCakeOptions(booking.location),
        getCakeSuppliesByOption(booking.location),
    ])
    const choice = (options: PartyFormCakeOption[], chosenName: string): SupplyChoice | null => {
        const chosen = options.find((option) => option.name === chosenName)
        const option = chosen && supplies.has(chosen.id) ? chosen : options.find((it) => supplies.has(it.id))
        if (!option) return null
        return {
            optionId: option.id,
            supplies: (supplies.get(option.id) ?? []).map((item) => item.name),
            ordered: option === chosen,
        }
    }
    return {
        serving: choice(servingOptions, booking.cake.served),
        candles: choice(candleOptions, booking.cake.candles),
    }
}

/** What checkout asks staff to confirm, or `null` when the party has no studio-stock cake. */
export async function getPartyCheckoutCake(booking: Booking) {
    if (!booking.cake || !isStockedPartyOrder(booking.type, booking.location)) return null
    const { serving, candles } = await getCakeSupplyChoices(booking)
    return {
        selection: booking.cake.selection,
        /** eg. ['Ice-cream cups', 'Spoons'], ticked if the parent chose them in the party form. */
        serving: serving && { supplies: serving.supplies, ordered: serving.ordered },
        candles: candles && { supplies: candles.supplies, ordered: candles.ordered },
    }
}

/**
 * Kept on the order as one metadata entry, since Square allows ten. With the booking id, children charged and discount
 * reason that's four booking entries, which fits because the party checkout never takes a discount code (see
 * `features/payments/README.md`).
 */
export function writeCakeUsage(usage: PartyCakeUsage) {
    return {
        [CAKE_USAGE_KEY]: [
            usage.cakeUsed ? 'cake' : 'no-cake',
            usage.cakeServingUsed ? 'serving' : 'no-serving',
            usage.cakeCandlesUsed ? 'candles' : 'no-candles',
        ].join(','),
    }
}

/**
 * What staff confirmed, or `null` for an order without it (eg. prepared before this was asked), which counts the cake
 * and what the parent chose as used.
 */
export function readCakeUsage(
    metadata: Record<string, string | null | undefined> | null | undefined
): PartyCakeUsage | null {
    const value = metadata?.[CAKE_USAGE_KEY]
    if (!value) return null
    const [cake, serving, candles] = value.split(',')
    return { cakeUsed: cake === 'cake', cakeServingUsed: serving === 'serving', cakeCandlesUsed: candles === 'candles' }
}
