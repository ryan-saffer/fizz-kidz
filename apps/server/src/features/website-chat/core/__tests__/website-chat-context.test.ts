import { describe, expect, it } from 'vite-plus/test'

import {
    CONTEXT_NOTE_PREFIX,
    REPLIED_INSTEAD_OF_CONFIRMING,
    withContextNote,
    withRecentHistory,
    withUnansweredConfirmationsDeclined,
} from '../website-chat-context'
import { getTranscriptFromModelMessages } from '../website-chat-transcript'

import type { ModelMessage, UIMessage } from 'ai'

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

describe('withRecentHistory', () => {
    const chat = (count: number): UIMessage[] =>
        Array.from({ length: count }, (_, index) => ({
            id: String(index),
            role: index % 2 === 0 ? 'user' : 'assistant',
            parts: [{ type: 'text', text: `message ${index}` }],
        }))

    it('keeps short chats whole', () => {
        expect(withRecentHistory(chat(10), 60)).toHaveLength(10)
    })

    it('keeps the latest messages of long chats, starting on a customer message', () => {
        const recent = withRecentHistory(chat(101), 60)

        expect(recent[0]).toMatchObject({ id: '42', role: 'user' })
        expect(recent.at(-1)).toMatchObject({ id: '100' })
    })
})

describe('withUnansweredConfirmationsDeclined', () => {
    const confirmation = (id: string): UIMessage => ({
        id,
        role: 'assistant',
        parts: [
            {
                type: 'tool-submit_enquiry',
                toolCallId: `call-${id}`,
                state: 'approval-requested',
                input: { name: 'Sam Lee' },
                approval: { id: `approval-${id}` },
            },
        ],
    })

    it('declines details the customer replied to by typing, with their reply to go on', () => {
        const messages = withUnansweredConfirmationsDeclined([
            confirmation('1'),
            { id: '2', role: 'user', parts: [{ type: 'text', text: 'My email is wrong' }] },
        ])

        expect(messages[0].parts[0]).toMatchObject({
            state: 'output-denied',
            approval: { id: 'approval-1', approved: false, reason: REPLIED_INSTEAD_OF_CONFIRMING },
        })
        expect(messages[1].parts[0]).toEqual({ type: 'text', text: 'My email is wrong' })
    })

    it('leaves the latest message alone, so a tap on Send enquiry still goes through', () => {
        const latest = confirmation('1')

        expect(withUnansweredConfirmationsDeclined([latest])[0]).toBe(latest)
    })
})
