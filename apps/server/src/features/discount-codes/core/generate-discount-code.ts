import { DateTime } from 'luxon'

import { createDiscountCode } from './create-discount-code'

import { generateRandomString } from '@/shared/strings/random-string'

/**
 * Generates a random discount code for a single use, and expire by the end of the upcoming holidays.
 */
export async function generateDiscountCode(name: string) {
    const code = `${name}-${generateRandomString(5)}`

    const CUT_OFF_DATES = [
        DateTime.fromISO('2025-01-20'),
        DateTime.fromISO('2025-04-22'),
        DateTime.fromISO('2025-07-21'),
        DateTime.fromISO('2025-10-06'),
    ]

    const today = new Date()
    let expiryDate = new Date()

    for (const date of CUT_OFF_DATES.reverse()) {
        if (today < date.toJSDate()) {
            expiryDate = date.toJSDate()
        }
    }

    await createDiscountCode({
        code,
        discountType: 'percentage',
        discountAmount: 10,
        expiryDate,
        numberOfUsesAllocated: 1,
    })

    return { code, expiryDate }
}
