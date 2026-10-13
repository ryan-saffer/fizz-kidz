import { toE164AustralianPhone } from '@fizz-kidz/core'

type Lead = {
    studio?: string
    source?: string
    email?: string
    contactNumber?: string
}

/**
 * Counts a website enquiry. Google Tag Manager turns `lead_submit` into the Google Analytics key event and the Google
 * Ads enquiry conversion. `user_data` (hashed by the Google tag before it leaves the browser) lets Google match a party
 * the server later reports as booked back to the ad click behind this enquiry.
 */
export function pushLeadSubmit({ studio, source, email, contactNumber }: Lead) {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
        event: 'lead_submit',
        ...(studio && { studio }),
        ...(source && { source }),
        user_data: {
            ...(email && { email: email.trim().toLowerCase() }),
            ...(contactNumber && { phone_number: toE164AustralianPhone(contactNumber) }),
        },
    })
}
