import {
    BRING_OWN_CAKE,
    CAKE_CANDLES_OPTIONS,
    CAKE_SERVED_OPTIONS,
    CAKE_SIZES,
    PRODUCT_DISCOUNT_PERCENT,
    PRODUCT_RRP,
    TAKE_HOME_BAG_PRICE,
} from '@fizz-kidz/core'

import type { FormValues } from './party-form-v2-form'

export const PRODUCT_PRICE = Math.round(PRODUCT_RRP * (1 - PRODUCT_DISCOUNT_PERCENT / 100) * 100) / 100

export function formatPrice(price: number) {
    return `$${price.toFixed(2).replace(/\.00$/, '')}`
}

export function calculateTotal(values: FormValues, canOrderCake: boolean) {
    let total = 0
    if (canOrderCake && values.cakeSelection && values.cakeSelection !== BRING_OWN_CAKE) {
        if (values.cakeSize) total += CAKE_SIZES[values.cakeSize].price
        if (values.cakeServed) total += CAKE_SERVED_OPTIONS[values.cakeServed].price
        if (values.cakeCandles) total += CAKE_CANDLES_OPTIONS[values.cakeCandles].price
    }
    total += Object.values(values.takeHomeBags).reduce((sum, quantity) => sum + quantity * TAKE_HOME_BAG_PRICE, 0)
    total += Object.values(values.products).reduce((sum, quantity) => sum + quantity * PRODUCT_PRICE, 0)
    return Math.round(total * 100) / 100
}
