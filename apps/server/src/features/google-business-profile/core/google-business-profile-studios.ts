import type { Studio } from '@fizz-kidz/core'

export const GOOGLE_BUSINESS_PROFILE_LOCATION_IDS = {
    balwyn: '7411403572200255542',
    cheltenham: '17799015894483126005',
    essendon: '3528483039786443602',
    geelong: '11438747137065650334',
    kingsville: '9935835601222746385',
    malvern: '12066138882170403782',
    werribee: '10356518758246450951',
} satisfies Record<Studio, string>

export const GOOGLE_BUSINESS_PROFILE_MAPS_URLS = {
    balwyn: 'https://maps.google.com/maps?cid=6136609433265597414',
    cheltenham: 'https://maps.google.com/maps?cid=8822831990781098434',
    essendon: 'https://maps.google.com/maps?cid=1446560198541755538',
    geelong: 'https://maps.google.com/maps?cid=14863149877002056080',
    kingsville: 'https://maps.google.com/maps?cid=5003607206578685972',
    malvern: 'https://maps.google.com/maps?cid=1875177454252405876',
    werribee: 'https://maps.google.com/maps?cid=5221345474664512450',
} satisfies Record<Studio, string>

export function getGoogleBusinessProfileLocationIdForStudio(studio: Studio) {
    return GOOGLE_BUSINESS_PROFILE_LOCATION_IDS[studio]
}

export function getGoogleBusinessProfileMapsUrlForStudio(studio: Studio | undefined) {
    if (!studio) return undefined

    return GOOGLE_BUSINESS_PROFILE_MAPS_URLS[studio]
}

export function getGoogleBusinessProfileLocationId(locationName: string) {
    return locationName.split('/').at(-1) ?? locationName
}

export function getGoogleBusinessProfileStudioFromLocationId(locationId: string): Studio | undefined {
    const entry = Object.entries(GOOGLE_BUSINESS_PROFILE_LOCATION_IDS).find(([, id]) => id === locationId)
    return entry?.[0] as Studio | undefined
}
