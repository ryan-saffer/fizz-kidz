import { describe, expect, it } from 'vite-plus/test'

import { CONTEXT_NOTE_PREFIX, withContextNote } from '../website-chat-context'
import { getTranscriptFromModelMessages } from '../website-chat-transcript'

import type { ModelMessage } from 'ai'

const conversation: ModelMessage[] = [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: [{ type: 'text', text: 'Hello!' }] },
    { role: 'user', content: 'Do you have a studio in Essendon?' },
]

describe('withContextNote', () => {
    it('adds the context to the latest customer message only, leaving earlier messages unchanged', () => {
        const messages = withContextNote(conversation, 'Today is Wednesday 30 September 2026.')

        expect(messages.slice(0, 2)).toEqual(conversation.slice(0, 2))
        expect(messages[2]).toEqual({
            role: 'user',
            content: [
                { type: 'text', text: 'Do you have a studio in Essendon?' },
                { type: 'text', text: `${CONTEXT_NOTE_PREFIX}\nToday is Wednesday 30 September 2026.` },
            ],
        })
    })

    it('keeps the note out of transcripts', () => {
        const transcript = getTranscriptFromModelMessages(withContextNote(conversation, 'Today is Wednesday.'))

        expect(transcript.at(-1)).toEqual({ role: 'customer', text: 'Do you have a studio in Essendon?' })
    })
})
