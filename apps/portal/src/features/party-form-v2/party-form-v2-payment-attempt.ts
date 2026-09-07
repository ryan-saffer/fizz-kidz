import { submitPartyFormV2Schema, type SubmitPartyFormV2 } from '@fizz-kidz/core'

const key = (bookingId: string) => `party-form-v2-payment:${bookingId}`

// Only Square's single-use tokens are stored, never card details. This tab keeps the
// exact request across reloads until the server confirms success or a definite failure.
export function readPartyPaymentAttempt(bookingId: string): SubmitPartyFormV2 | null {
    try {
        const stored = sessionStorage.getItem(key(bookingId))
        if (!stored) return null
        const parsed = submitPartyFormV2Schema.safeParse(JSON.parse(stored))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

export function savePartyPaymentAttempt(bookingId: string, input: SubmitPartyFormV2) {
    sessionStorage.setItem(key(bookingId), JSON.stringify(input))
}

export function clearPartyPaymentAttempt(bookingId: string) {
    try {
        sessionStorage.removeItem(key(bookingId))
    } catch {
        /* A completed checkout remains idempotent if storage cannot be cleared. */
    }
}
