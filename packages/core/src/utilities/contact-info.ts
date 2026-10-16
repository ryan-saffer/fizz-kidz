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
                ownerEmail: 'swetha.d@fizzkidz.com.au',
            }
        case 'kingsville':
            return {
                email: 'kingsville@fizzkidz.com.au',
                phoneDisplay: '0403 057 999',
                contactName: 'Kate',
                contactSignoff: 'Kate and the Fizz Kidz team',
                ownerEmail: 'kate.p@fizzkidz.com.au',
            }
        case 'werribee':
            return {
                email: 'werribee@fizzkidz.com.au',
                phoneDisplay: '0433 522 071',
                contactName: 'Paris',
                contactSignoff: 'Paris and the Fizz Kidz team',
                ownerEmail: 'paris.c@fizzkidz.com.au',
            }
        case 'master':
            return {
                email: genericContact.email,
                phoneDisplay: genericContact.mainPhoneDisplay,
                contactSignoff: genericContact.teamName,
                ownerEmail: undefined,
            }
        default: {
            assertNever(studio)
            throw new Error(`Unknown location during getPartyCustomerContactInfo: '${studio}'`)
        }
    }
}

/**
 * Who hears about changes to a studio's parties (cancelled, moved away): the studio inbox, plus the owner when the
 * studio is a franchise.
 */
export function getStudioNotificationEmails(location: Studio, env: 'dev' | 'prod' = 'prod'): string[] {
    const { ownerEmail } = getPartyCustomerContactInfo(location)
    const studioEmail = getStudioContactEmail(location, env)
    if (env === 'dev') return [studioEmail]
    return ownerEmail ? [studioEmail, ownerEmail] : [studioEmail]
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
