// A charge this iPad has on the terminal. Storage can be unavailable (e.g. private browsing); the checkout still works
// without it, but a reload then loses track of a charge in progress.

const chargeKey = (bookingId: string) => `party-checkout-charge:${bookingId}`

/** A charge on the terminal, so reopening the checkout after a reload keeps waiting for it. */
export function readCharge(bookingId: string) {
    return read<{ checkoutId: string; terminalCheckoutId: string }>(
        chargeKey(bookingId),
        (value) => typeof value?.checkoutId === 'string' && typeof value?.terminalCheckoutId === 'string'
    )
}

export function saveCharge(bookingId: string, charge: { checkoutId: string; terminalCheckoutId: string }) {
    write(chargeKey(bookingId), charge)
}

export function clearCharge(bookingId: string) {
    write(chargeKey(bookingId), null)
}

function read<T>(key: string, isValid: (value: Partial<Record<keyof T, unknown>> | null) => boolean): T | null {
    try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null')
        return isValid(value) ? (value as T) : null
    } catch {
        return null
    }
}

function write(key: string, value: unknown) {
    try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, JSON.stringify(value))
    } catch {
        /* see above */
    }
}
