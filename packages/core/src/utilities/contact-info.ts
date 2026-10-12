import { getFranchiseOrMaster, type Studio } from '../core/studio'
import { assertNever } from './assert-never'

export function getCustomerContactInfo() {
    return {
        email: 'bookings@fizzkidz.com.au',
        teamName: 'The Fizz Kidz team',
        mainPhoneDisplay: '(03) 9059 8144',
        mainPhoneHref: '+61390598144',
    }
}

export function getPartyCustomerContactInfo(location: Studio) {
    const genericContact = getCustomerContactInfo()
    const studio = getFranchiseOrMaster(location)

    switch (studio) {
        case 'balwyn':
            return {
                email: 'balwyn@fizzkidz.com.au',
                phoneDisplay: '0452 020 191',
                contactName: 'Swetha',
                contactSignoff: 'Swetha and the Fizz Kidz team',
            }
        case 'kingsville':
            return {
                email: 'kingsville@fizzkidz.com.au',
                phoneDisplay: '0403 057 999',
                contactName: 'Kate',
                contactSignoff: 'Kate and the Fizz Kidz team',
            }
        case 'werribee':
            return {
                email: 'werribee@fizzkidz.com.au',
                phoneDisplay: '0433 522 071',
                contactName: 'Paris',
                contactSignoff: 'Paris and the Fizz Kidz team',
            }
        case 'master':
            return {
                email: genericContact.email,
                phoneDisplay: genericContact.mainPhoneDisplay,
                contactSignoff: genericContact.teamName,
            }
        default: {
            assertNever(studio)
            throw new Error(`Unknown location during getPartyCustomerContactInfo: '${studio}'`)
        }
    }
}

export function getStudioContactEmail(location: Studio, env: 'dev' | 'prod' = 'prod'): string {
    if (env === 'dev') {
        return 'ryan@fizzkidz.com.au'
    }

    switch (location) {
        case 'balwyn':
            return 'balwyn@fizzkidz.com.au'
        case 'cheltenham':
            return 'cheltenham@fizzkidz.com.au'
        case 'essendon':
            return 'essendon@fizzkidz.com.au'
        case 'geelong':
            return 'geelong@fizzkidz.com.au'
        case 'kingsville':
            return 'kingsville@fizzkidz.com.au'
        case 'malvern':
            return 'malvern@fizzkidz.com.au'
        case 'werribee':
            return 'werribee@fizzkidz.com.au'
        default: {
            const exhaustiveCheck: never = location
            throw new Error(`Unknown location: ${exhaustiveCheck}`)
        }
    }
}
