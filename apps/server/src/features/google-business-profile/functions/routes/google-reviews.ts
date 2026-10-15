import express from 'express'

import { isStudio, type GoogleBusinessProfileReview, type Studio } from '@fizz-kidz/core'

import {
    getGoogleBusinessProfileLocationIdForStudio,
    getGoogleBusinessProfileMapsUrlForStudio,
} from '../../core/google-business-profile-studios'
import { orderGoogleReviews } from '../../core/order-google-reviews'

import { DatabaseClient } from '@/integrations/firebase/database.client'

type PublicGoogleReview = {
    id: string
    review: string
    writtenBy: string
    writtenYear: string
    writtenDate: string
    rating: number
    location?: string
    reviewUrl?: string
    source: 'Google'
}

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 30

export const googleReviewsRoute = express.Router()

googleReviewsRoute.get('/reviews/google', async (req, res) => {
    const limit = getLimit(req.query.limit)
    const studio = getStudioQueryParam(req.query.location)
    const locationId = studio ? getGoogleBusinessProfileLocationIdForStudio(studio) : undefined

    const publishableReviews = (await DatabaseClient.getGoogleBusinessProfileReviews({ limit, studio, locationId }))
        .filter((review) => !!review.comment)
        .filter((review) => (review.starRatingValue ?? 0) >= 4)

    const reviews = orderGoogleReviews(publishableReviews).slice(0, limit).map(mapReview)

    res.set('Cache-Control', 'public, max-age=300, s-maxage=3600')
    res.json({ reviews })
})

function mapReview(review: GoogleBusinessProfileReview): PublicGoogleReview {
    const studio = review.studio

    return {
        id: review.reviewId ?? review.reviewName,
        review: review.comment ?? '',
        writtenBy: review.reviewerIsAnonymous ? 'Google reviewer' : (review.reviewerDisplayName ?? 'Google reviewer'),
        writtenYear: getYear(review.createTime ?? review.updateTime),
        writtenDate: getMonthYear(review.createTime ?? review.updateTime),
        rating: review.starRatingValue ?? 5,
        location: review.locationTitle ?? undefined,
        reviewUrl: getGoogleBusinessProfileMapsUrlForStudio(studio ?? undefined),
        source: 'Google',
    }
}

function getLimit(input: unknown) {
    const rawLimit = Array.isArray(input) ? input[0] : input
    const parsedLimit = Number(rawLimit ?? DEFAULT_LIMIT)

    if (!Number.isFinite(parsedLimit)) return DEFAULT_LIMIT
    return Math.min(Math.max(Math.floor(parsedLimit), 1), MAX_LIMIT)
}

function getStudioQueryParam(input: unknown): Studio | undefined {
    const value = Array.isArray(input) ? input[0] : input
    if (typeof value !== 'string') return undefined

    const studio = value.trim().toLowerCase()
    return isStudio(studio) ? studio : undefined
}

function getYear(input: string | null | undefined) {
    if (!input) return new Date().getFullYear().toString()

    const date = new Date(input)
    if (Number.isNaN(date.getTime())) return new Date().getFullYear().toString()

    return date.getFullYear().toString()
}

function getMonthYear(input: string | null | undefined) {
    if (!input) return new Date().getFullYear().toString()

    const date = new Date(input)
    if (Number.isNaN(date.getTime())) return new Date().getFullYear().toString()

    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}
