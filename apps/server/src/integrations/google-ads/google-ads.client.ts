/**
 * The Fizz Kidz Google Ads manager account. Its conversion actions are shared with every studio's Ads account through
 * cross-account conversion tracking, so conversions are sent here once.
 */
export const GOOGLE_ADS_MANAGER_CUSTOMER_ID = '8391382546'

/** Manager-account conversion actions the server reports to. */
export const GOOGLE_ADS_CONVERSION_ACTIONS = {
    partyBooking: '7842224284',
} as const

/** A conversion matched to its ad click by the customer's hashed contact details (enhanced conversions for leads). */
export type OfflineConversion = {
    transactionId: string
    eventTimestamp: string
    conversionValue: number
    currency: 'AUD'
    /** SHA-256 hashes, hex encoded. */
    userIdentifiers: ({ emailAddress: string } | { phoneNumber: string })[]
}

/**
 * Sends offline conversions through the Data Manager API, which Google requires for new conversion uploads. Runs as the
 * functions' runtime service account: it must be a user on the manager account and able to use the Data Manager API
 * in the bookings-prod Cloud project.
 */
export async function sendOfflineConversions(conversionActionId: string, conversions: OfflineConversion[]) {
    const { google } = await import('googleapis')
    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/datamanager', 'https://www.googleapis.com/auth/cloud-platform'],
    })
    const { token } = await (await auth.getClient()).getAccessToken()
    const account = { accountType: 'GOOGLE_ADS', accountId: GOOGLE_ADS_MANAGER_CUSTOMER_ID }

    const response = await fetch('https://datamanager.googleapis.com/v1/events:ingest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            destinations: [
                { operatingAccount: account, loginAccount: account, productDestinationId: conversionActionId },
            ],
            encoding: 'HEX',
            // Google Ads requires a source. WEB: these conversions trace back to a website enquiry.
            events: conversions.map(({ userIdentifiers, ...event }) => ({
                ...event,
                eventSource: 'WEB',
                userData: { userIdentifiers },
            })),
        }),
    })
    if (!response.ok) {
        throw new Error(`Data Manager API events:ingest failed with ${response.status}: ${await response.text()}`)
    }
    return (await response.json()) as { requestId: string }
}
