import { type StudioOrTest } from '../core/studio'
import { capitalise } from './stringUtilities'

import type { Studio } from '../core/studio'
import type { Booking } from '../partyBookings/booking'

export function getStudioAddress(location: Studio) {
    switch (location) {
        case 'balwyn':
            return '184 Whitehorse Rd, Balwyn VIC 3103'
        case 'cheltenham':
            return '273 Bay Rd, Cheltenham VIC 3192'
        case 'essendon':
            return '75 Raleigh St, Essendon VIC 3040'
        case 'geelong':
            return '352 Pakington St, Newtown VIC 3220'
        case 'kingsville':
            return '238 Somerville Rd, Kingsville, VIC 3012'
        case 'malvern':
            return '20 Glenferrie Rd, Malvern VIC 3144'
        case 'werribee':
            return 'T5, Harpley Town Center, Bradfield St, Werribee VIC 3030'
        default: {
            const exhaustiveCheck: never = location
            throw new Error(`cannot get address of unknown location: '${exhaustiveCheck}'`)
        }
    }
}

export function getPartyEndDate(start: Date, partyLength: Booking['partyLength']) {
    // determine when party ends
    let lengthHours = 0
    let lengthMinutes = 0
    switch (partyLength) {
        case '1':
            lengthHours = 1
            break
        case '1.5':
            lengthHours = 1
            lengthMinutes = 30
            break
        case '2':
            lengthHours = 2
            break
        default: {
            const exhaustiveCheck: never = partyLength
            throw new Error(`invalid party length of '${exhaustiveCheck}'`)
        }
    }

    const endDate = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        start.getHours() + lengthHours,
        start.getMinutes() + lengthMinutes
    )

    return endDate
}

export function getApplicationDomain(environment: 'prod' | 'dev', useEmulator: boolean) {
    if (useEmulator) {
        return 'http://localhost:3000'
    }
    return environment === 'prod' ? 'https://bookings.fizzkidz.com.au' : 'https://dev.fizzkidz.com.au'
}

export function getPartyCreationCount(type: Booking['type'], partyLength: '1' | '1.5' | '2') {
    if (type === 'mobile') {
        switch (partyLength) {
            case '1':
                return 'two'
            case '1.5':
                return 'three'
            default:
                throw new Error('invalid combination of party location and length')
        }
    } else {
        switch (partyLength) {
            case '1.5':
                return 'two'
            case '2':
                return 'three'
            default:
                throw new Error('invalid combination of party location and length')
        }
    }
}

export function getNumberOfKidsAllowed(location: Studio) {
    if (location === 'cheltenham') {
        return ['4 and 5 years old - max 20 kids', '6 years plus - max 26 kids']
    } else {
        return ['4 and 5 years old - max 24 kids', '6 years plus - max 30 kids']
    }
}

export function getPictureOfStudioUrl(location: Studio) {
    switch (location) {
        case 'balwyn':
            return 'https://www.fizzkidz.com.au/images/studios/balwyn.jpg'
        case 'cheltenham':
            return 'https://www.fizzkidz.com.au/images/studios/cheltenham.jpg'
        case 'essendon':
            return 'https://www.fizzkidz.com.au/images/studios/essendon.jpg'
        case 'geelong':
            // TODO: Update image
            return 'https://www.fizzkidz.com.au/images/studios/kingsville.jpg'
        case 'kingsville':
            return 'https://www.fizzkidz.com.au/images/studios/kingsville.jpg'
        case 'malvern':
            return 'https://www.fizzkidz.com.au/images/studios/malvern.jpg'
        case 'werribee':
            // TODO: Update image
            return 'https://www.fizzkidz.com.au/images/studios/kingsville.jpg'
        default: {
            const exhaustiveCheck: never = location
            throw new Error(`Unhandled location: '${exhaustiveCheck}`)
        }
    }
}

export function getReviewUrl(location: Studio) {
    switch (location) {
        case 'balwyn':
            return 'https://g.page/r/CeZrGzPEnSlVEBM/review'
        case 'cheltenham':
            return 'https://g.page/r/CcK5dUPz_nB6EBM/review'
        case 'essendon':
            return 'https://g.page/r/CZLETBzWNhMUEBM/review'
        case 'geelong':
            return 'https://g.page/r/CZAxGZYQhETOEBM/review'
        case 'kingsville':
            return 'https://g.page/r/CRQItX8-YnBFEBM/review'
        case 'malvern':
            return 'https://g.page/r/CXQ0iaP19wUaEBM/review'
        case 'werribee':
            return 'https://g.page/r/CcK7-JoL8nVIEBM/review'
        default: {
            const exhaustiveCheck: never = location
            throw new Error(`Unhandled location in getReviewUrl: '${exhaustiveCheck}'`)
        }
    }
}

export function studioNameAndAddress(studio: StudioOrTest) {
    if (studio === 'test') {
        return 'TEST'
    }

    return `Fizz Kidz ${capitalise(studio)}\nStudio<br>${getStudioAddress(studio)}`
}

export function getNumberOfCreations(bookingType: Booking['type'], partyLength: Booking['partyLength']) {
    if (bookingType === 'studio') {
        return partyLength === '1.5' ? 2 : 3
    }
    return partyLength === '1' ? 2 : 3
}
