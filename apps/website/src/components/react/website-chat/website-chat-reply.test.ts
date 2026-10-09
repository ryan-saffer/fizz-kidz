import { describe, expect, it } from 'vite-plus/test'

import { getReplyItems } from './website-chat-reply'

import type { UIMessage } from 'ai'

describe('getReplyItems', () => {
    it('lists the bubbles, then the enquiry details', () => {
        const message = {
            id: '1',
            role: 'assistant',
            parts: [
                { type: 'text', text: 'Thanks, Sam!\n\nJust to confirm before I send this through:' },
                { type: 'tool-submit_enquiry', toolCallId: 'call-1', state: 'approval-requested', input: {} },
            ],
        } as UIMessage

        expect(getReplyItems(message).map((item) => item.kind)).toEqual(['text', 'text', 'enquiry'])
    })
})
