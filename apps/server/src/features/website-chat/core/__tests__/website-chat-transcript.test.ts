import { describe, expect, it } from 'vite-plus/test'

import { WEBSITE_CHAT_CHANGE_SOMETHING_REASON, WEBSITE_CHAT_DONT_SEND_REASON } from '@fizz-kidz/core'

import { getTranscriptFromUIMessages } from '../website-chat-transcript'

import type { UIMessage } from 'ai'

function enquiryDetails(approval: { approved?: boolean; reason?: string }, state: string): UIMessage {
    return {
        id: 'enquiry',
        role: 'assistant',
        parts: [
            { type: 'text', text: 'Just to confirm before I send this through:' },
            {
                type: 'tool-submit_enquiry',
                toolCallId: 'call-1',
                state,
                input: { name: 'Sam Lee' },
                approval: { id: 'approval-1', ...approval },
            } as UIMessage['parts'][number],
        ],
    }
}

describe('getTranscriptFromUIMessages', () => {
    it.each([
        [{}, 'approval-requested', '[Showed the enquiry details to confirm]'],
        [
            { approved: false, reason: WEBSITE_CHAT_CHANGE_SOMETHING_REASON },
            'approval-responded',
            '[Customer chose to change the details]',
        ],
        [
            { approved: false, reason: WEBSITE_CHAT_DONT_SEND_REASON },
            'output-denied',
            '[Customer chose not to send the enquiry]',
        ],
    ])('notes what the customer did with the enquiry details', (approval, state, note) => {
        expect(getTranscriptFromUIMessages([enquiryDetails(approval, state)])).toEqual([
            { role: 'frankie', text: `Just to confirm before I send this through:\n\n${note}` },
        ])
    })
})
