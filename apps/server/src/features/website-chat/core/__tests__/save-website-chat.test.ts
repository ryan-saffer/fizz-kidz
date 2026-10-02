import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { saveWebsiteChat } from '../save-website-chat'

import type { UIMessage } from 'ai'

const mocks = vi.hoisted(() => ({ getWebsiteChat: vi.fn(), setWebsiteChat: vi.fn() }))
vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: mocks }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))

const finishedAt = new Date('2026-10-01T12:40:00Z')
const receivedAt = new Date('2026-10-02T09:00:00Z')

const messages: UIMessage[] = [
    { id: '1', role: 'user', parts: [{ type: 'text', text: 'Can you book us in?' }] },
    {
        id: '2',
        role: 'assistant',
        parts: [
            {
                type: 'tool-submit_enquiry',
                toolCallId: 'call',
                state: 'output-available',
                input: {},
                output: { success: true },
            },
            { type: 'text', text: 'Thanks so much!' },
        ],
    },
]

describe('saveWebsiteChat', () => {
    beforeEach(() => {
        mocks.getWebsiteChat.mockReset()
        mocks.setWebsiteChat.mockReset()
    })

    it('reopens a finished chat when it resumes, keeping when it last finished', async () => {
        mocks.getWebsiteChat.mockResolvedValue({
            id: 'chat-12345678',
            status: 'finished',
            entryPage: '/',
            startedAt: new Date('2026-10-01T11:00:00Z'),
            finishedAt,
            enquirySubmitted: false,
            messages: [],
        })

        await saveWebsiteChat({ id: 'chat-12345678', messages, model: 'openai/gpt-6-luna', pagePath: '/', receivedAt })

        expect(mocks.setWebsiteChat).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'active', finishedAt, enquirySubmitted: true, messageCount: 1 })
        )
    })

    it('keeps the times of messages already saved and stamps new ones', async () => {
        mocks.getWebsiteChat.mockResolvedValue({
            id: 'chat-12345678',
            status: 'active',
            entryPage: '/',
            startedAt: new Date('2026-10-02T08:59:00Z'),
            enquirySubmitted: false,
            messages: [{ role: 'customer', text: 'Can you book us in?', sentAt: '2026-10-02T08:59:30.000Z' }],
        })

        await saveWebsiteChat({ id: 'chat-12345678', messages, model: 'openai/gpt-6-luna', pagePath: '/', receivedAt })

        const saved = mocks.setWebsiteChat.mock.calls[0][0].messages
        expect(saved[0].sentAt).toBe('2026-10-02T08:59:30.000Z')
        expect(saved[1]).toMatchObject({ role: 'frankie', sentAt: expect.any(String) })
    })
})
