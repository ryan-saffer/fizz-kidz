import { deepStrictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import type { GoogleBusinessProfileReview } from '@fizz-kidz/core'

import { orderGoogleReviews } from './order-google-reviews'

function createReview(reviewName: string, starRatingValue: number) {
    return { reviewName, starRatingValue } as GoogleBusinessProfileReview
}

function names(reviews: GoogleBusinessProfileReview[]) {
    return reviews.map((review) => review.reviewName)
}

describe('orderGoogleReviews', () => {
    it('moves the two newest 5 star reviews ahead of newer 4 star reviews', () => {
        const reviews = [
            createReview('a', 4),
            createReview('b', 5),
            createReview('c', 4),
            createReview('d', 5),
            createReview('e', 5),
        ]

        deepStrictEqual(names(orderGoogleReviews(reviews)), ['b', 'd', 'a', 'c', 'e'])
    })

    it('keeps the order when the first two are already 5 star', () => {
        const reviews = [createReview('a', 5), createReview('b', 5), createReview('c', 4), createReview('d', 5)]

        deepStrictEqual(names(orderGoogleReviews(reviews)), ['a', 'b', 'c', 'd'])
    })

    it('leads with whatever 5 star reviews exist when there are fewer than two', () => {
        const reviews = [createReview('a', 4), createReview('b', 4), createReview('c', 5)]

        deepStrictEqual(names(orderGoogleReviews(reviews)), ['c', 'a', 'b'])
    })
})
