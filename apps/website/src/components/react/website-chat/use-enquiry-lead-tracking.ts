import { useEffect, useRef } from 'react'

import type { UIMessage } from 'ai'

import { pushLeadSubmit } from '@/utils/lead-tracking'

export type SentEnquiry = { toolCallId: string; studio?: string; email?: string; contactNumber?: string }

/** Every enquiry Frankie successfully sent in a conversation. */
export function getSentEnquiries(messages: UIMessage[]): SentEnquiry[] {
    return messages.flatMap((message) =>
        message.parts.flatMap((part) =>
            part.type === 'tool-submit_enquiry' &&
            part.state === 'output-available' &&
            (part.output as { success?: boolean } | undefined)?.success === true
                ? [toSentEnquiry(part.toolCallId, part.input as EnquiryInput | undefined)]
                : []
        )
    )
}

type EnquiryInput = { location?: string; email?: string; contactNumber?: string }

function toSentEnquiry(toolCallId: string, input: EnquiryInput | undefined): SentEnquiry {
    return { toolCallId, studio: input?.location, email: input?.email, contactNumber: input?.contactNumber }
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
            pushLeadSubmit({
                studio: enquiry.studio,
                source: 'website-chat',
                email: enquiry.email,
                contactNumber: enquiry.contactNumber,
            })
        }
    }, [messages])
}
