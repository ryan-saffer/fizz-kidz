import { useEffect, useRef } from 'react'

import type { UIMessage } from 'ai'

export type SentEnquiry = { toolCallId: string; studio?: string }

/** Every enquiry Frankie successfully sent in a conversation. */
export function getSentEnquiries(messages: UIMessage[]): SentEnquiry[] {
    return messages.flatMap((message) =>
        message.parts.flatMap((part) =>
            part.type === 'tool-submit_enquiry' &&
            part.state === 'output-available' &&
            (part.output as { success?: boolean } | undefined)?.success === true
                ? [{ toolCallId: part.toolCallId, studio: (part.input as { location?: string } | undefined)?.location }]
                : []
        )
    )
}

/**
 * Counts enquiries sent through Frankie as leads, like the website forms: Google Tag Manager turns `lead_submit` into
 * the Google Analytics key event and the Google Ads conversion. Each enquiry is counted once, and a restored chat's
 * earlier enquiries aren't counted again.
 */
export function useEnquiryLeadTracking(messages: UIMessage[]) {
    const trackedIdsRef = useRef<Set<string> | null>(null)

    useEffect(() => {
        const sentEnquiries = getSentEnquiries(messages)
        if (!trackedIdsRef.current) {
            trackedIdsRef.current = new Set(sentEnquiries.map((enquiry) => enquiry.toolCallId))
            return
        }
        for (const enquiry of sentEnquiries) {
            if (trackedIdsRef.current.has(enquiry.toolCallId)) continue
            trackedIdsRef.current.add(enquiry.toolCallId)
            window.dataLayer = window.dataLayer || []
            window.dataLayer.push({ event: 'lead_submit', studio: enquiry.studio, source: 'website-chat' })
        }
    }, [messages])
}
