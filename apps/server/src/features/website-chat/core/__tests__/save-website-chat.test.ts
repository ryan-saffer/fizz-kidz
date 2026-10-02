import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { saveWebsiteChat } from '../save-website-chat'

import type { UIMessage } from 'ai'

const mocks = vi.hoisted(() => ({ getWebsiteChat: vi.fn(), setWebsiteChat: vi.fn() }))
vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: mocks }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))

const finishedAt = new Date('2026-10-01T12:40:00Z')

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
        })

        await saveWebsiteChat({ id: 'chat-12345678', messages, model: 'openai/gpt-6-luna', pagePath: '/' })

        expect(mocks.setWebsiteChat).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'active', finishedAt, enquirySubmitted: true, messageCount: 1 })
        )
    })
})
