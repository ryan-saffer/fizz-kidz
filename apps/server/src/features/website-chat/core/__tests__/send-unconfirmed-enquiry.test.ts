import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { WebsiteChat } from '@fizz-kidz/core'

import { sendUnconfirmedEnquiry } from '../send-unconfirmed-enquiry'

const mocks = vi.hoisted(() => ({ generateText: vi.fn(), submit: vi.fn(), logError: vi.fn() }))
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<object>()), generateText: mocks.generateText }))
vi.mock('../submit-enquiry-tool', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    submitWebsiteChatEnquiry: mocks.submit,
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const enquiry = {
    name: 'Khyati Patel',
    email: 'khyati@example.com',
    contactNumber: '0400 111 222',
    service: 'party',
    enquiry: 'Wants a party at Balwyn on Saturday 10 October, and asked what is in the optional lolly bags.',
}

function chat(customerMessages: string[]): WebsiteChat {
    return {
        id: 'chat-1',
        status: 'active',
        model: 'openai/gpt-6-luna',
        entryPage: '/birthday-parties/',
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: customerMessages.length,
        enquirySubmitted: false,
        messages: customerMessages.flatMap((text) => [
            { role: 'customer' as const, text },
            { role: 'frankie' as const, text: 'Thanks!' },
        ]),
    }
}

const withContactDetails = chat(['Khyati Patel', 'khyati@example.com', '0400 111 222'])

describe('sendUnconfirmedEnquiry', () => {
    beforeEach(() => {
        mocks.generateText.mockReset()
        mocks.submit.mockReset()
        mocks.logError.mockReset()
    })

    it('sends the enquiry the model fills in from the chat, flagged as unconfirmed', async () => {
        mocks.generateText.mockResolvedValue({ toolCalls: [{ toolName: 'submit_enquiry', input: enquiry }] })
        mocks.submit.mockResolvedValue({ success: true })

        await expect(sendUnconfirmedEnquiry(withContactDetails)).resolves.toBe(true)

        expect(mocks.submit).toHaveBeenCalledWith(enquiry, {
            chatTranscript: expect.stringContaining('Customer: khyati@example.com'),
            isUnconfirmed: true,
        })
    })

    it("doesn't send when the model skips it, e.g. they asked not to be contacted", async () => {
        mocks.generateText.mockResolvedValue({ toolCalls: [{ toolName: 'skip', input: { reason: 'Asked not to' } }] })

        await expect(sendUnconfirmedEnquiry(withContactDetails)).resolves.toBe(false)
        expect(mocks.submit).not.toHaveBeenCalled()
    })

    it('skips chats without an email and phone number, without asking the model', async () => {
        await expect(sendUnconfirmedEnquiry(chat(['Do you do slime parties?', 'sam@example.com']))).resolves.toBe(false)
        expect(mocks.generateText).not.toHaveBeenCalled()
    })

    it("respects a tap on Don't send, without asking the model", async () => {
        const declined = chat(['Khyati Patel', 'khyati@example.com', '0400 111 222'])
        declined.messages.push(
            {
                role: 'frankie',
                text: 'Just to confirm before I send this through:\n\n[Customer chose not to send the enquiry]',
            },
            { role: 'frankie', text: 'No worries at all!' }
        )

        await expect(sendUnconfirmedEnquiry(declined)).resolves.toBe(false)
        expect(mocks.generateText).not.toHaveBeenCalled()
    })

    it("sends when they're shown the details again after Don't send", async () => {
        const changedMind = chat(['Khyati Patel', 'khyati@example.com', '0400 111 222'])
        changedMind.messages.push(
            { role: 'frankie', text: '[Customer chose not to send the enquiry]' },
            { role: 'customer', text: 'Actually, yes please send it' },
            { role: 'frankie', text: 'Lovely!\n\n[Showed the enquiry details to confirm]' }
        )
        mocks.generateText.mockResolvedValue({ toolCalls: [{ toolName: 'submit_enquiry', input: enquiry }] })
        mocks.submit.mockResolvedValue({ success: true })

        await expect(sendUnconfirmedEnquiry(changedMind)).resolves.toBe(true)
    })

    it('logs a failure and carries on', async () => {
        mocks.generateText.mockRejectedValue(new Error('Gateway down'))

        await expect(sendUnconfirmedEnquiry(withContactDetails)).resolves.toBe(false)
        expect(mocks.logError).toHaveBeenCalled()
    })
})
