import type { WebsiteChatModel, WebsiteChatTranscriptMessage } from '@fizz-kidz/core'

import { getTranscriptFromUIMessages } from './website-chat-transcript'

import type { UIMessage } from 'ai'

import { DatabaseClient } from '@/integrations/firebase/database.client'
import { logError } from '@/integrations/observability/log-error'

/** Saves the whole conversation after each reply. The widget sends the full history, so the latest save is complete. */
export async function saveWebsiteChat({
    id,
    messages,
    model,
    pagePath,
    receivedAt,
}: {
    id: string
    messages: UIMessage[]
    model: WebsiteChatModel
    pagePath?: string
    /** When the server received the customer's latest message. */
    receivedAt: Date
}) {
    try {
        const existing = await DatabaseClient.getWebsiteChat(id)
        const now = new Date()

        await DatabaseClient.setWebsiteChat({
            id,
            // A message on a finished chat (e.g. a tab left open overnight) reopens it, so it's reported again with its
            // latest outcome when it next goes idle. finishedAt is kept, which marks the report as resumed.
            status: 'active',
            model,
            entryPage: existing?.entryPage ?? pagePath ?? null,
            startedAt: existing?.startedAt ?? now,
            lastMessageAt: now,
            ...(existing?.finishedAt && { finishedAt: existing.finishedAt }),
            messageCount: messages.filter((message) => message.role === 'user').length,
            enquirySubmitted: existing?.enquirySubmitted === true || hasSubmittedEnquiry(messages),
            messages: withSentTimes(getTranscriptFromUIMessages(messages), existing?.messages ?? [], {
                receivedAt,
                now,
            }),
        })
    } catch (err) {
        logError('Failed to save website chat transcript', err, { chatId: id })
    }
}

// Messages already saved keep their times. New ones are stamped now: the customer's message when the server received
// it, Frankie's reply when it finished.
function withSentTimes(
    transcript: WebsiteChatTranscriptMessage[],
    previous: WebsiteChatTranscriptMessage[],
    { receivedAt, now }: { receivedAt: Date; now: Date }
): WebsiteChatTranscriptMessage[] {
    return transcript.map((message, index) => ({
        ...message,
        sentAt:
            index < previous.length
                ? previous[index].sentAt
                : (message.role === 'customer' ? receivedAt : now).toISOString(),
    }))
}

function hasSubmittedEnquiry(messages: UIMessage[]) {
    return messages.some((message) =>
        message.parts.some(
            (part) =>
                part.type === 'tool-submit_enquiry' &&
                part.state === 'output-available' &&
                (part.output as { success?: boolean } | undefined)?.success === true
        )
    )
}
