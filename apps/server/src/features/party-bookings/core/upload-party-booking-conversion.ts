import { createHash } from 'crypto'

import { DateTime } from 'luxon'

import { toE164AustralianPhone } from '@fizz-kidz/core'
import type { BaseBooking } from '@fizz-kidz/core'

import type { ClickConversion } from '@/integrations/google-ads/google-ads.client'

import { getConversionAction, uploadClickConversions } from '@/integrations/google-ads/google-ads.client'
import { logError } from '@/integrations/observability/log-error'

/** The manager-account conversion party bookings are reported as. */
export const PARTY_BOOKING_CONVERSION = 'Party Booking'

type PartyBookingDetails = Pick<
    BaseBooking,
    'parentEmail' | 'parentMobile' | 'type' | 'partyLength' | 'numberOfChildren'
>

/**
 * The website's published prices (October 2026), used only to give Google Ads an estimated value to bid on. The real
 * amount is charged through Square after the party.
 */
const PARTY_PRICES = {
    studio: { '1': [480, 40], '1.5': [480, 40], '2': [636, 53] },
    mobile: { '1': [468, 39], '1.5': [564, 47], '2': [564, 47] },
} as const
const CHILDREN_INCLUDED = 12

export function estimatePartyValue({ type, partyLength, numberOfChildren }: PartyBookingDetails) {
    const [base, perExtraChild] = PARTY_PRICES[type][partyLength]
    const children = Number.parseInt(numberOfChildren, 10) || CHILDREN_INCLUDED
    return base + Math.max(0, children - CHILDREN_INCLUDED) * perExtraChild
}

/** Google's normalisation for hashed emails: trimmed, lowercase, and no dots before the @ for Gmail addresses. */
export function normaliseEmail(email: string) {
    const [local, domain] = email.trim().toLowerCase().split('@')
    if (domain === 'gmail.com' || domain === 'googlemail.com') return `${local.replace(/\./g, '')}@${domain}`
    return `${local}@${domain}`
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function buildPartyBookingConversion(
    bookingId: string,
    booking: PartyBookingDetails,
    conversionAction: string,
    bookedAt: DateTime
): ClickConversion {
    const phone = toE164AustralianPhone(booking.parentMobile)
    return {
        conversionAction,
        conversionDateTime: bookedAt.setZone('Australia/Melbourne').toFormat('yyyy-MM-dd HH:mm:ssZZ'),
        conversionValue: estimatePartyValue(booking),
        currencyCode: 'AUD',
        orderId: bookingId,
        userIdentifiers: [
            { hashedEmail: sha256(normaliseEmail(booking.parentEmail)) },
            ...(phone ? [{ hashedPhoneNumber: sha256(phone) }] : []),
        ],
    }
}

/**
 * Tells Google Ads a party was booked. Google matches the parent's hashed email and phone to the website enquiry that
 * carried the same details, and credits the ad click behind it. Bookings without an ad click are ignored by Google.
 */
export async function uploadPartyBookingConversion(bookingId: string, booking: PartyBookingDetails) {
    const conversionAction = await getConversionAction(PARTY_BOOKING_CONVERSION)
    const conversion = buildPartyBookingConversion(bookingId, booking, conversionAction, DateTime.now())
    const { partialFailureError } = await uploadClickConversions([conversion])
    if (partialFailureError) {
        logError('Google Ads rejected a party booking conversion', undefined, {
            bookingId,
            error: partialFailureError.message,
        })
    }
}
