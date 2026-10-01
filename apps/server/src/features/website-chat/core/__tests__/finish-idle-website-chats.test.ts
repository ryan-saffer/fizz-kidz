import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { WebsiteChat } from '@fizz-kidz/core'

import { finishIdleWebsiteChats } from '../finish-idle-website-chats'

const mocks = vi.hoisted(() => ({ getActive: vi.fn(), update: vi.fn(), track: vi.fn() }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: { getActiveWebsiteChats: mocks.getActive, updateWebsiteChat: mocks.update },
}))
vi.mock('@/integrations/mixpanel/mixpanel.client', () => ({
    MixpanelClient: { getInstance: async () => ({ track: mocks.track }) },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))

const now = new Date('2026-09-29T10:00:00+10:00')
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000)

function chat(overrides: Partial<WebsiteChat>): WebsiteChat {
    return {
        id: 'chat-idle-1',
        status: 'active',
        model: 'openai/gpt-5.4-nano',
        entryPage: '/birthday-parties/',
        startedAt: minutesAgo(50),
        lastMessageAt: minutesAgo(40),
        messageCount: 4,
        enquirySubmitted: true,
        messages: [],
        ...overrides,
    }
}

describe('finishIdleWebsiteChats', () => {
    beforeEach(() => {
        mocks.getActive.mockReset()
        mocks.update.mockReset()
        mocks.track.mockReset()
    })

    it('finishes idle chats and reports each once', async () => {
        mocks.getActive.mockResolvedValue([chat({})])

        await finishIdleWebsiteChats(now)

        expect(mocks.update).toHaveBeenCalledWith('chat-idle-1', { status: 'finished', finishedAt: now })
        expect(mocks.track).toHaveBeenCalledWith('website-chat-finished', {
            distinct_id: 'chat-idle-1',
            chatId: 'chat-idle-1',
            messageCount: 4,
            durationMinutes: 10,
            outcome: 'enquiry',
            model: 'openai/gpt-5.4-nano',
            entryPage: '/birthday-parties/',
        })
    })

    it('leaves chats that are still going', async () => {
        mocks.getActive.mockResolvedValue([chat({ id: 'chat-recent', lastMessageAt: minutesAgo(5) })])

        await finishIdleWebsiteChats(now)

        expect(mocks.update).not.toHaveBeenCalled()
        expect(mocks.track).not.toHaveBeenCalled()
    })
})
