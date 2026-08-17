import { strictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import { getPictureOfStudioUrl, getReviewUrl, getStudioAddress, studioNameAndAddress } from './studio-details'

describe('studio details', () => {
    it('returns studio details', () => {
        strictEqual(getStudioAddress('balwyn'), '184 Whitehorse Rd, Balwyn VIC 3103')
        strictEqual(getPictureOfStudioUrl('malvern'), 'https://www.fizzkidz.com.au/images/studios/malvern.jpg')
        strictEqual(getReviewUrl('werribee'), 'https://g.page/r/CcK7-JoL8nVIEBM/review')
    })

    it('formats a studio name and address', () => {
        strictEqual(studioNameAndAddress('essendon'), 'Fizz Kidz Essendon\nStudio<br>75 Raleigh St, Essendon VIC 3040')
    })

    it('uses the test placeholder', () => {
        strictEqual(studioNameAndAddress('test'), 'TEST')
    })
})
