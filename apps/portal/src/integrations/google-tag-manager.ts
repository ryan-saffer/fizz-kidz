import { toE164AustralianPhone } from '@fizz-kidz/core'
import type { StudioOrTest } from '@fizz-kidz/core'

/** The website's container. Its tags forward booking events to GA4 and the Google Ads manager account. */
const GOOGLE_TAG_MANAGER_ID = 'GTM-NBCZ5XHQ'

/** Loads the container once on a public booking page. */
export function loadGoogleTagManager() {
    const scriptId = `gtm-script-${GOOGLE_TAG_MANAGER_ID}`
    if (document.getElementById(scriptId)) {
        return
    }

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })

    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_MANAGER_ID}`
    document.head.appendChild(script)
}

export type BookingConversion = {
    event: 'holiday_program_booking' | 'preschool_program_booking'
    transactionId: string
    value: number
    currency: 'AUD'
    studio: StudioOrTest
    parentEmail: string
    parentPhone: string
}

/**
 * Reports a paid booking. GTM sends it to GA4 and Google Ads; the Google tag passes `user_data`
 * to Ads as enhanced conversions (hashed before it leaves the browser).
 */
export function pushBookingConversion(conversion: BookingConversion) {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
        event: conversion.event,
        value: conversion.value,
        currency: conversion.currency,
        transaction_id: conversion.transactionId,
        studio: conversion.studio,
        user_data: {
            email: conversion.parentEmail.trim().toLowerCase(),
            phone_number: toE164AustralianPhone(conversion.parentPhone),
        },
    })
}
