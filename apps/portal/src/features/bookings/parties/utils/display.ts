import { DateTime } from 'luxon'

import {
    ObjectKeys,
    PRODUCTS,
    TAKE_HOME_BAGS,
    getBirthdayPartyCreationDisplayName,
    getBookingAdditionDisplayValues,
    getPartyEndDate,
} from '@fizz-kidz/core'
import type { BirthdayPartyBookingCatalogue, FirestoreBooking } from '@fizz-kidz/core'

const ZONE = 'Australia/Melbourne'

export function getPartyTimes(booking: FirestoreBooking) {
    const start = booking.dateTime.toDate()
    const format = (date: Date) => DateTime.fromJSDate(date, { zone: ZONE }).toFormat('h:mm a').toLowerCase()
    return { start: format(start), end: format(getPartyEndDate(start, booking.partyLength)) }
}

export function getPartyDate(booking: FirestoreBooking) {
    return DateTime.fromJSDate(booking.dateTime.toDate(), { zone: ZONE }).toFormat('cccc d LLLL yyyy')
}

export function getPartyLengthLabel(length: FirestoreBooking['partyLength']) {
    return length === '1' ? '1 hour' : `${length} hours`
}

/** Each birthday child and the age they're turning. Older bookings only have one combined name and age. */
export function getBirthdayChildren(booking: FirestoreBooking) {
    const children = booking.children?.filter((child) => child.name.trim())
    return children && children.length > 0 ? children : [{ name: booking.childName, age: booking.childAge }]
}

export function getCreationNames(booking: FirestoreBooking, catalogue: BirthdayPartyBookingCatalogue | undefined) {
    return [booking.creation1, booking.creation2, booking.creation3]
        .filter((creation): creation is string => !!creation)
        .map((creation) => getBirthdayPartyCreationDisplayName(creation, catalogue))
}

export function getAdditionNames(booking: FirestoreBooking) {
    return getBookingAdditionDisplayValues(booking)
}

/** Take-home bags and products bought through the party form, as `{ name, quantity }`. */
export function getPurchasedGoodies(booking: FirestoreBooking) {
    const bags = ObjectKeys(TAKE_HOME_BAGS).map((bag) => ({
        name: TAKE_HOME_BAGS[bag].displayValue,
        quantity: booking.takeHomeBags?.[bag] ?? 0,
    }))
    const products = ObjectKeys(PRODUCTS).map((product) => ({
        name: PRODUCTS[product].displayValue,
        quantity: booking.products?.[product] ?? 0,
    }))
    return [...bags, ...products].filter((goodie) => goodie.quantity > 0)
}
