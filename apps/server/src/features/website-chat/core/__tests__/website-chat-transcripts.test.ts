import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { WebsiteChat } from '@fizz-kidz/core'

import {
    deleteWebsiteChatTranscripts,
    getWebsiteChatTranscript,
    listWebsiteChatTranscripts,
} from '../website-chat-transcripts'

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    listWebsiteChats: vi.fn(),
    getWebsiteChat: vi.fn(),
    deleteWebsiteChats: vi.fn(),
}))
vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: mocks }))

const chat: WebsiteChat = {
    id: 'chat-12345678',
    status: 'finished',
    model: 'openai/gpt-5.6-luna',
    entryPage: '/birthday-parties/',
    startedAt: new Date('2026-09-30T01:00:00Z'),
    lastMessageAt: new Date('2026-09-30T01:05:00Z'),
    finishedAt: new Date('2026-09-30T01:40:00Z'),
    messageCount: 1,
    enquirySubmitted: false,
    messages: [
        { role: 'customer', text: 'Can we have a slime party?' },
        { role: 'frankie', text: 'Absolutely!' },
    ],
}

describe('website chat transcripts', () => {
    beforeEach(() => {
        Object.values(mocks).forEach((mock) => mock.mockReset())
        mocks.listWebsiteChats.mockResolvedValue([chat])
        mocks.getWebsiteChat.mockResolvedValue(chat)
    })

    it('lists chats for super-admins', async () => {
        mocks.getUser.mockResolvedValue({ accountType: 'staff', roles: { master: 'super-admin' } })

        await expect(listWebsiteChatTranscripts('uid')).resolves.toEqual([
            expect.objectContaining({
                id: 'chat-12345678',
                startedAt: '2026-09-30T01:00:00.000Z',
                preview: 'Can we have a slime party?',
            }),
        ])
    })

    it('refuses other staff, including admins', async () => {
        mocks.getUser.mockResolvedValue({ accountType: 'staff', roles: { master: 'admin', balwyn: 'manager' } })

        await expect(listWebsiteChatTranscripts('uid')).rejects.toMatchObject({ code: 'FORBIDDEN' })
        await expect(getWebsiteChatTranscript('chat-12345678', 'uid')).rejects.toMatchObject({ code: 'FORBIDDEN' })
        expect(mocks.listWebsiteChats).not.toHaveBeenCalled()
        expect(mocks.getWebsiteChat).not.toHaveBeenCalled()
    })

    it('returns the full transcript, or not found', async () => {
        mocks.getUser.mockResolvedValue({ accountType: 'staff', roles: { master: 'super-admin' } })

        await expect(getWebsiteChatTranscript('chat-12345678', 'uid')).resolves.toMatchObject({
            messages: chat.messages,
        })

        mocks.getWebsiteChat.mockResolvedValue(undefined)
        await expect(getWebsiteChatTranscript('chat-missing1', 'uid')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('lets super-admins delete transcripts, and no one else', async () => {
        mocks.getUser.mockResolvedValue({ accountType: 'staff', roles: { master: 'admin' } })
        await expect(deleteWebsiteChatTranscripts(['chat-12345678'], 'uid')).rejects.toMatchObject({
            code: 'FORBIDDEN',
        })
        expect(mocks.deleteWebsiteChats).not.toHaveBeenCalled()

        mocks.getUser.mockResolvedValue({ accountType: 'staff', roles: { master: 'super-admin' } })
        await expect(deleteWebsiteChatTranscripts(['chat-12345678', 'chat-87654321'], 'uid')).resolves.toEqual({
            deleted: 2,
        })
        expect(mocks.deleteWebsiteChats).toHaveBeenCalledWith(['chat-12345678', 'chat-87654321'])
    })
})
