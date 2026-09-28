import { formatCents, type PreparePos, type PosOption, type Studio } from '@fizz-kidz/core'

import type { EstimateLine } from '@features/terminal-checkout/components/order-summary'
import { createTerminalCheckoutStore } from '@features/terminal-checkout/state/terminal-checkout-store'

/** The products a studio sells, from Square. */
export type PosConfig = { products: PosOption[] }

export type PosAnswers = Omit<PreparePos, 'studio'>

/**
 * Selling products at a studio: staff choose the products and quantities, check Square's price, then charge the
 * studio's terminal, which offers the customer a receipt. The subject is the studio. How a charge is sent and checked
 * is the shared terminal checkout's (`features/terminal-checkout`); this adds the products step.
 */
export const usePosStore = createTerminalCheckoutStore<Studio, PosConfig, PosAnswers>({
    storageKey: 'pos-charge',
    getSubjectId: (studio) => studio,
    steps: [{ key: 'products', label: 'Products' }],
    initialAnswers: { items: [], discountCents: 0, discountReason: '', giftCardNumber: '' },
})

/** The items with one product's quantity changed; none removes it. */
export function setQuantity(items: PosAnswers['items'], variationId: string, quantity: number) {
    const others = items.filter((item) => item.variationId !== variationId)
    if (quantity <= 0) return others
    const index = items.findIndex((item) => item.variationId === variationId)
    const item = { variationId, quantity: Math.min(quantity, MAX_QUANTITY) }
    // a product keeps its place in the list as its quantity changes
    return index === -1 ? [...items, item] : items.map((it) => (it.variationId === variationId ? item : it))
}

export const MAX_QUANTITY = 50

/** The chosen products as order summary lines, from Square's prices, before Square prices the sale. */
export function getEstimateLines(config: PosConfig, answers: PosAnswers): EstimateLine[] {
    return answers.items.flatMap((item) => {
        const product = config.products.find((it) => it.variationId === item.variationId)
        return product
            ? [
                  {
                      key: item.variationId,
                      label: `${item.quantity} × ${product.name}`,
                      detail: item.quantity > 1 ? `${formatCents(product.priceCents)} each` : undefined,
                      amountCents: product.priceCents * item.quantity,
                  },
              ]
            : []
    })
}
