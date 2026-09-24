export const HOLIDAY_PROGRAM_POLICY = {
    title: 'Cancellation and rescheduling policy',
    paragraphs: [
        'Plans changed? If your session is at least 48 hours away, you can move to another available holiday-program session at the same studio, or cancel for an automatic full refund of the amount paid.',
        "Less than 48 hours to go? You can still cancel before the session starts, but refunds and rescheduling aren't available.",
        "Use Change / Cancel in your confirmation email. Each link manages one child's session, so morning and afternoon bookings need to be changed separately.",
        'This policy may change at our discretion.',
    ],
} as const

/**
 * Rescheduling and refunds require at least 48 hours notice. Cancelling is allowed until the session starts.
 */
export function getHolidayProgramChangeEligibility(datetime: string, canceled = false, now = Date.now()) {
    const hoursRemaining = (new Date(datetime).getTime() - now) / (60 * 60 * 1000)
    return {
        canCancel: !canceled && hoursRemaining > 0,
        canReschedule: !canceled && hoursRemaining >= 48,
    }
}
