import type { GoogleBusinessProfileReview } from '@fizz-kidz/core'

// Desktop shows two reviews at a time, so both visible slots should be 5 star.
const LEADING_FIVE_STAR_COUNT = 2

/**
 * Keeps the newest-first order, but moves the newest 5 star reviews into the first slots
 * so a 4 star review is never the first thing a visitor sees.
 */
export function orderGoogleReviews(reviews: GoogleBusinessProfileReview[]) {
    const leading = reviews.filter((review) => review.starRatingValue === 5).slice(0, LEADING_FIVE_STAR_COUNT)
    return [...leading, ...reviews.filter((review) => !leading.includes(review))]
}
