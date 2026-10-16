/**
 * The "Fizz Kidz Website" Meta dataset (pixel). Every studio's Meta ad account is connected to it, so events are sent
 * here once.
 */
export const META_DATASET_ID = '492339101434056'

/** A Conversions API server event. */
export type MetaServerEvent = {
    event_name: 'Purchase'
    /** Unix seconds. Meta rejects events older than 7 days. */
    event_time: number
    /** Lets Meta deduplicate the same event sent twice. */
    event_id: string
    action_source: 'system_generated'
    /** SHA-256 hashes, hex encoded, of Meta-normalised values. */
    user_data: { em: string[]; ph?: string[]; country: string[] }
    custom_data: { value: number; currency: 'AUD'; content_category: string; order_id: string; studio: string }
}

/**
 * Sends events through Meta's Conversions API. Needs `META_CONVERSIONS_API_TOKEN`, an access token generated in Events
 * Manager for the dataset (Settings → Conversions API).
 */
export async function sendMetaEvents(events: MetaServerEvent[]) {
    const token = process.env.META_CONVERSIONS_API_TOKEN
    if (!token) {
        throw new Error('META_CONVERSIONS_API_TOKEN is not set')
    }

    const response = await fetch(`https://graph.facebook.com/v24.0/${META_DATASET_ID}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: events, access_token: token }),
    })
    if (!response.ok) {
        throw new Error(`Meta Conversions API failed with ${response.status}: ${await response.text()}`)
    }
    return (await response.json()) as { events_received: number; fbtrace_id: string }
}
