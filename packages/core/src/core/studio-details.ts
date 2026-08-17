import { capitalise } from '../utilities/stringUtilities'

import type { Studio, StudioOrTest } from './studio'

type StudioDetails = {
    address: string
    pictureUrl: string
    reviewUrl: string
}

const STUDIO_DETAILS: Record<Studio, StudioDetails> = {
    balwyn: {
        address: '184 Whitehorse Rd, Balwyn VIC 3103',
        pictureUrl: 'https://www.fizzkidz.com.au/images/studios/balwyn.jpg',
        reviewUrl: 'https://g.page/r/CeZrGzPEnSlVEBM/review',
    },
    cheltenham: {
        address: '273 Bay Rd, Cheltenham VIC 3192',
        pictureUrl: 'https://www.fizzkidz.com.au/images/studios/cheltenham.jpg',
        reviewUrl: 'https://g.page/r/CcK5dUPz_nB6EBM/review',
    },
    essendon: {
        address: '75 Raleigh St, Essendon VIC 3040',
        pictureUrl: 'https://www.fizzkidz.com.au/images/studios/essendon.jpg',
        reviewUrl: 'https://g.page/r/CZLETBzWNhMUEBM/review',
    },
    geelong: {
        address: '352 Pakington St, Newtown VIC 3220',
        pictureUrl: 'https://www.fizzkidz.com.au/images/studios/kingsville.jpg',
        reviewUrl: 'https://g.page/r/CZAxGZYQhETOEBM/review',
    },
    kingsville: {
        address: '238 Somerville Rd, Kingsville, VIC 3012',
        pictureUrl: 'https://www.fizzkidz.com.au/images/studios/kingsville.jpg',
        reviewUrl: 'https://g.page/r/CRQItX8-YnBFEBM/review',
    },
    malvern: {
        address: '20 Glenferrie Rd, Malvern VIC 3144',
        pictureUrl: 'https://www.fizzkidz.com.au/images/studios/malvern.jpg',
        reviewUrl: 'https://g.page/r/CXQ0iaP19wUaEBM/review',
    },
    werribee: {
        address: 'T5, Harpley Town Center, Bradfield St, Werribee VIC 3030',
        pictureUrl: 'https://www.fizzkidz.com.au/images/studios/kingsville.jpg',
        reviewUrl: 'https://g.page/r/CcK7-JoL8nVIEBM/review',
    },
}

export function getStudioAddress(studio: Studio) {
    return STUDIO_DETAILS[studio].address
}

export function getPictureOfStudioUrl(studio: Studio) {
    return STUDIO_DETAILS[studio].pictureUrl
}

export function getReviewUrl(studio: Studio) {
    return STUDIO_DETAILS[studio].reviewUrl
}

export function studioNameAndAddress(studio: StudioOrTest) {
    if (studio === 'test') {
        return 'TEST'
    }

    return `Fizz Kidz ${capitalise(studio)}\nStudio<br>${getStudioAddress(studio)}`
}
