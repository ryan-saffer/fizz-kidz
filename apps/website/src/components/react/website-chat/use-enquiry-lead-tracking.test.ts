// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vite-plus/test'

import { getSentEnquiries, useEnquiryLeadTracking } from './use-enquiry-lead-tracking'

import type { UIMessage } from 'ai'

function enquiryMessage(id: string, toolCallId: string, success = true, state = 'output-available'): UIMessage {
    return {
        id,
        role: 'assistant',
        parts: [
            {
                type: 'tool-submit_enquiry',
                toolCallId,
                state,
                input: { location: 'essendon' },
                output: { success },
            } as UIMessage['parts'][number],
        ],
    }
}

describe('getSentEnquiries', () => {
    it('finds enquiries Frankie sent, and ignores failed or unfinished ones', () => {
        const messages = [
            enquiryMessage('1', 'failed', false),
            enquiryMessage('2', 'pending', true, 'input-available'),
            enquiryMessage('3', 'sent'),
        ]

        expect(getSentEnquiries(messages)).toEqual([{ toolCallId: 'sent', studio: 'essendon' }])
    })
})

describe('useEnquiryLeadTracking', () => {
    beforeEach(() => {
        window.dataLayer = []
    })

    it('pushes lead_submit once for an enquiry sent on this page', () => {
        const { rerender } = renderHook(({ messages }) => useEnquiryLeadTracking(messages), {
            initialProps: { messages: [] as UIMessage[] },
        })

        rerender({ messages: [enquiryMessage('1', 'call-1')] })
        rerender({ messages: [enquiryMessage('1', 'call-1')] })

        expect(window.dataLayer).toEqual([{ event: 'lead_submit', studio: 'essendon', source: 'website-chat' }])
    })

    it("doesn't count enquiries a restored chat already sent", () => {
        const restored = [enquiryMessage('1', 'call-earlier')]
        const { rerender } = renderHook(({ messages }) => useEnquiryLeadTracking(messages), {
            initialProps: { messages: restored },
        })

        rerender({ messages: [...restored, enquiryMessage('2', 'call-new')] })

        expect(window.dataLayer).toEqual([{ event: 'lead_submit', studio: 'essendon', source: 'website-chat' }])
    })
})
