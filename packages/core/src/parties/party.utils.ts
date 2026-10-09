import { ADDITIONS, type Addition } from './additions'

import type { Studio } from '../core/studio'
import type { BirthdayPartyBookingCatalogue } from './birthday-party-catalogue'
import type { BaseBooking, Booking } from './booking'

const CAKE_ORDER_EXCLUDED_STUDIOS: Studio[] = ['geelong', 'werribee']

export function getBookingCreationDisplayValues(booking: BaseBooking, catalogue?: BirthdayPartyBookingCatalogue) {
    return [booking.creation1, booking.creation2, booking.creation3]
        .filter((creation) => creation !== undefined)
        .map((creation) => getBirthdayPartyCreationDisplayName(creation, catalogue))
}

/**
 * A booked creation's name. Bookings hold its key, but older bookings can hold a value that's now one of its legacy
 * labels. Without a match (or before the catalogue loads) the key is spelled out rather than shown raw.
 */
export function getBirthdayPartyCreationDisplayName(key: string, catalogue?: BirthdayPartyBookingCatalogue) {
    const normalize = (value: string) => value.trim().toLocaleLowerCase('en-AU')
    const creation =
        catalogue?.creations.find((it) => it.key === key) ??
        catalogue?.creations.find((it) => [it.name, ...it.legacyLabels].some((it) => normalize(it) === normalize(key)))
    // e.g. 'sparklingLipBalm' -> 'Sparkling Lip Balm'
    return creation?.name ?? key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (first) => first.toUpperCase())
}

export function getBookingAdditionDisplayValues(booking: BaseBooking) {
    return Object.keys(booking)
        .filter(isPartyAdditionKey)
        .filter((addition) => booking[addition])
        .map((addition) => ADDITIONS[addition].displayValue)
}

export function isPartyAdditionKey(key: string): key is Addition {
    return Object.prototype.hasOwnProperty.call(ADDITIONS, key)
}

export function getPartyEndDate(start: Date, partyLength: Booking['partyLength']) {
    const durationMinutes = {
        '1': 60,
        '1.5': 90,
        '2': 120,
    } satisfies Record<Booking['partyLength'], number>

    return new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        start.getHours(),
        start.getMinutes() + durationMinutes[partyLength]
    )
}

export function getPartyCreationCount(booking: Pick<Booking, 'type' | 'partyLength'>): 2 | 3 {
    if (
        (booking.type === 'mobile' && booking.partyLength === '1') ||
        (booking.type === 'studio' && booking.partyLength === '1.5')
    ) {
        return 2
    }

    return 3
}

export function getPartyChildCapacityMessages(location: Studio) {
    if (location === 'cheltenham') {
        return ['4 and 5 years old - max 20 kids', '6 years plus - max 26 kids']
    }

    return ['4 and 5 years old - max 24 kids', '6 years plus - max 30 kids']
}

export function canOrderCake(type: Booking['type'], studio: Studio) {
    return type === 'studio' && !CAKE_ORDER_EXCLUDED_STUDIOS.includes(studio)
}
