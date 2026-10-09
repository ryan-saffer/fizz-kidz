// A charge this iPad has on the terminal. Storage can be unavailable (e.g. private browsing); the checkout still works
// without it, but a reload then loses track of a charge in progress.

import type { Charge } from './terminal-checkout-store'

/** A charge on the terminal, so reopening the checkout after a reload keeps waiting for it. */
export function readCharge(key: string): Charge | null {
    try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null')
        return typeof value?.checkoutId === 'string' && typeof value?.terminalCheckoutId === 'string'
            ? { checkoutId: value.checkoutId, terminalCheckoutId: value.terminalCheckoutId }
            : null
    } catch {
        return null
    }
}

export function saveCharge(key: string, charge: Charge) {
    try {
        localStorage.setItem(key, JSON.stringify(charge))
    } catch {
        /* see above */
    }
}

export function clearCharge(key: string) {
    try {
        localStorage.removeItem(key)
    } catch {
        /* see above */
    }
}
