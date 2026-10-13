/**
 * The Fizz Kidz Google Ads manager account. Its conversion actions are shared with every studio's Ads account through
 * cross-account conversion tracking, so conversions are uploaded here once.
 */
export const GOOGLE_ADS_MANAGER_CUSTOMER_ID = '8391382546'

const API_URL = 'https://googleads.googleapis.com/v25'

/** A conversion matched to its ad click by the parent's hashed contact details (enhanced conversions for leads). */
export type ClickConversion = {
    conversionAction: string
    conversionDateTime: string
    conversionValue: number
    currencyCode: 'AUD'
    orderId: string
    userIdentifiers: ({ hashedEmail: string } | { hashedPhoneNumber: string })[]
}

/**
 * Calls the Google Ads API as the server's runtime service account, which must be a user on the manager account.
 * Access is granted to the bookings-prod Cloud project, so no developer token is needed.
 */
async function post<T>(path: string, body: unknown): Promise<T> {
    const { google } = await import('googleapis')
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/adwords'] })
    const { token } = await (await auth.getClient()).getAccessToken()

    const response = await fetch(`${API_URL}/${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'login-customer-id': GOOGLE_ADS_MANAGER_CUSTOMER_ID,
        },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        throw new Error(`Google Ads API ${path} failed with ${response.status}: ${await response.text()}`)
    }
    return (await response.json()) as T
}

const conversionActions = new Map<string, string>()

/** The resource name of a manager-account conversion action, looked up by its name once per instance. */
export async function getConversionAction(name: string) {
    const cached = conversionActions.get(name)
    if (cached) return cached

    const { results = [] } = await post<{ results?: { conversionAction: { resourceName: string } }[] }>(
        `customers/${GOOGLE_ADS_MANAGER_CUSTOMER_ID}/googleAds:search`,
        {
            query: `SELECT conversion_action.resource_name FROM conversion_action WHERE conversion_action.name = '${name}' AND conversion_action.status = 'ENABLED'`,
        }
    )
    const resourceName = results[0]?.conversionAction.resourceName
    if (!resourceName) throw new Error(`No enabled Google Ads conversion action named '${name}'`)

    conversionActions.set(name, resourceName)
    return resourceName
}

export async function uploadClickConversions(conversions: ClickConversion[]) {
    return post<{ partialFailureError?: { message: string } }>(
        `customers/${GOOGLE_ADS_MANAGER_CUSTOMER_ID}:uploadClickConversions`,
        { conversions, partialFailure: true }
    )
}
