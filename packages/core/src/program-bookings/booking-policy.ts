export type ProgramBookingPolicy = { title: string; paragraphs: readonly string[] }

export const HOLIDAY_PROGRAM_POLICY = {
    title: 'Holiday program cancellation and rescheduling policy',
    paragraphs: [
        'Plans changed? If your session is at least 48 hours away, you can move to another available holiday-program session at the same studio, or cancel for an automatic full refund of the amount paid.',
        "Less than 48 hours to go? You can still cancel before the session starts, but refunds and rescheduling aren't available.",
        "Use Change / Cancel in your confirmation email. Each link manages one child's session, so morning and afternoon bookings need to be changed separately.",
        'This policy may change at our discretion.',
    ],
} as const satisfies ProgramBookingPolicy

export const PRESCHOOL_PROGRAM_POLICY = {
    title: 'Preschool Program cancellation and rescheduling policy',
    paragraphs: [
        'Plans changed? If your session is at least 48 hours away, you can move to another available Preschool Program session in the same term at the same studio, on any day, or cancel for an automatic refund.',
        'Full-term bookings receive 20% off because every session in the term is booked. Rescheduling keeps the discount. Cancelling a session means the booking no longer covers the full term, so the discount is removed from the remaining sessions and taken out of your refund. This can make the refund small, or nothing at all.',
        "Less than 48 hours to go? You can still cancel before the session starts, but refunds and rescheduling aren't available.",
        "Use Change / Cancel in your confirmation email. Each link manages one child's session.",
        'This policy may change at our discretion.',
    ],
} as const satisfies ProgramBookingPolicy

/**
 * Holiday and Preschool Program sessions share one cutoff: rescheduling and refunds require at least 48 hours notice.
 * Cancelling is allowed until the session starts.
 */
export function getSessionChangeEligibility(datetime: string, canceled = false, now = Date.now()) {
    const hoursRemaining = (new Date(datetime).getTime() - now) / (60 * 60 * 1000)
    return {
        canCancel: !canceled && hoursRemaining > 0,
        canReschedule: !canceled && hoursRemaining >= 48,
    }
}
