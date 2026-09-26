import { BRING_OWN_CAKE, orderedQuantities } from '@fizz-kidz/core'

import type { FormValues } from '../state/form'
import type { PartyFormV2Config } from '../state/party-form-store'

export function formatPrice(price: number) {
    return `$${price.toFixed(2).replace(/\.00$/, '')}`
}

/** A display estimate from Square's prices; the server's Square order is the amount actually charged. */
export function calculateTotal(
    values: FormValues,
    { cakeOptions, takeHomeOptions }: Pick<PartyFormV2Config, 'cakeOptions' | 'takeHomeOptions'>
) {
    const priceCents = (options: { name: string; priceCents: number }[], name: string) =>
        options.find((option) => option.name === name)?.priceCents ?? 0
    const unitCents = (options: { key: string; priceCents: number }[], key: string) =>
        options.find((option) => option.key === key)?.priceCents ?? 0

    let cents = 0
    if (cakeOptions && values.cakeSelection && values.cakeSelection !== BRING_OWN_CAKE) {
        cents +=
            priceCents(cakeOptions.sizes, values.cakeSize) +
            priceCents(cakeOptions.designs, values.cakeSelection) +
            priceCents(cakeOptions.servingOptions, values.cakeServed) +
            priceCents(cakeOptions.candleOptions, values.cakeCandles) +
            values.cakeFlavours.reduce((sum, flavour) => sum + priceCents(cakeOptions.flavours, flavour), 0)
    }
    if (takeHomeOptions) {
        for (const [key, quantity] of orderedQuantities(values.takeHomeBags))
            cents += quantity * unitCents(takeHomeOptions.takeHomeBags, key)
        for (const [key, quantity] of orderedQuantities(values.products))
            cents += quantity * unitCents(takeHomeOptions.products, key)
    }
    return cents / 100
}

/** A take-home item's Square name, falling back to its booking label when Square no longer offers it. */
export function takeHomeName(options: { key: string; name: string }[] | undefined, key: string, fallback: string) {
    return options?.find((option) => option.key === key)?.name ?? fallback
}
