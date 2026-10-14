import { createHash } from 'crypto'

import { DateTime } from 'luxon'

import { toE164AustralianPhone } from '@fizz-kidz/core'
import type { BaseBooking } from '@fizz-kidz/core'

import type { OfflineConversion } from '@/integrations/google-ads/google-ads.client'

import {
    GOOGLE_ADS_CONVERSION_ACTIONS,
    GOOGLE_ADS_CUSTOM_VARIABLES,
    sendOfflineConversions,
} from '@/integrations/google-ads/google-ads.client'

type PartyBookingDetails = Pick<
    BaseBooking,
    'parentEmail' | 'parentMobile' | 'location' | 'type' | 'partyLength' | 'numberOfChildren'
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
    bookedAt: DateTime
): OfflineConversion {
    const phone = toE164AustralianPhone(booking.parentMobile)
    return {
        transactionId: bookingId,
        eventTimestamp: bookedAt.setZone('Australia/Melbourne').toISO({ suppressMilliseconds: true }),
        conversionValue: estimatePartyValue(booking),
        currency: 'AUD',
        customVariables: [{ variable: GOOGLE_ADS_CUSTOM_VARIABLES.studio, value: booking.location }],
        userIdentifiers: [
            { emailAddress: sha256(normaliseEmail(booking.parentEmail)) },
            ...(phone ? [{ phoneNumber: sha256(phone) }] : []),
        ],
    }
}

/**
 * Tells Google Ads a party was booked. Google matches the parent's hashed email and phone to the website enquiry that
 * carried the same details, and credits the ad click behind it. Bookings without an ad click are ignored by Google.
 */
export async function uploadPartyBookingConversion(bookingId: string, booking: PartyBookingDetails) {
    await sendOfflineConversions(GOOGLE_ADS_CONVERSION_ACTIONS.partyBooking, [
        buildPartyBookingConversion(bookingId, booking, DateTime.now()),
    ])
}
