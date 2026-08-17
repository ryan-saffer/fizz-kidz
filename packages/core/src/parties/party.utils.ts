import { ADDITIONS, type Addition } from './additions'
import { CREATIONS } from './creations'

import type { Studio } from '../core/studio'
import type { BaseBooking, Booking } from './booking'

const CAKE_ORDER_EXCLUDED_STUDIOS: Studio[] = ['geelong', 'werribee']

export function getBookingCreationDisplayValues(booking: BaseBooking) {
    return [booking.creation1, booking.creation2, booking.creation3]
        .filter((creation) => creation !== undefined)
        .map((creation) => CREATIONS[creation])
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
