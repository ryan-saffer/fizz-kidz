import { createHash } from 'crypto'

import { DateTime } from 'luxon'

import { toE164AustralianPhone } from '@fizz-kidz/core'
import type { BaseBooking } from '@fizz-kidz/core'

import type { OfflineConversion } from '@/integrations/google-ads/google-ads.client'
import type { MetaServerEvent } from '@/integrations/meta/meta.client'

import {
    GOOGLE_ADS_CONVERSION_ACTIONS,
    GOOGLE_ADS_CUSTOM_VARIABLES,
    sendOfflineConversions,
} from '@/integrations/google-ads/google-ads.client'
import { sendMetaEvents } from '@/integrations/meta/meta.client'

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

/** Meta normalises emails by trimming and lowercasing only, unlike Google it keeps Gmail dots. */
export function buildPartyBookingMetaEvent(
    bookingId: string,
    booking: PartyBookingDetails,
    bookedAt: DateTime
): MetaServerEvent {
    const phone = toE164AustralianPhone(booking.parentMobile)
    return {
        event_name: 'Purchase',
        event_time: Math.floor(bookedAt.toSeconds()),
        event_id: bookingId,
        // Staff book the party after the enquiry, so it comes from our system rather than the website.
        action_source: 'system_generated',
        user_data: {
            em: [sha256(booking.parentEmail.trim().toLowerCase())],
            // Meta wants digits only, with the country code.
            ...(phone && { ph: [sha256(phone.replace('+', ''))] }),
            country: [sha256('au')],
        },
        custom_data: {
            value: estimatePartyValue(booking),
            currency: 'AUD',
            content_category: 'party',
            order_id: bookingId,
            studio: booking.location,
        },
    }
}

/**
 * Tells Meta a party was booked, as a Purchase on the website dataset. Meta matches the parent's hashed email and phone
 * to the people its ads reached, the same way it matches the website enquiry's Lead.
 */
export async function sendPartyBookingToMeta(bookingId: string, booking: PartyBookingDetails) {
    await sendMetaEvents([buildPartyBookingMetaEvent(bookingId, booking, DateTime.now())])
}
