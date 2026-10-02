import { WEBSITE_CHAT_IDLE_MINUTES } from '@fizz-kidz/core'

import { DatabaseClient } from '@/integrations/firebase/database.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'

/**
 * Conversations never explicitly end, so one is finished once it has been idle for WEBSITE_CHAT_IDLE_MINUTES.
 * Each finished conversation is reported to Mixpanel once, with the ID of its Firestore transcript.
 */
export async function finishIdleWebsiteChats(now = new Date()) {
    const cutoff = now.getTime() - WEBSITE_CHAT_IDLE_MINUTES * 60 * 1000
    const idleChats = (await DatabaseClient.getActiveWebsiteChats()).filter(
        (chat) => chat.lastMessageAt.getTime() <= cutoff
    )
    if (idleChats.length === 0) return

    const mixpanel = await MixpanelClient.getInstance()

    for (const chat of idleChats) {
        try {
            await DatabaseClient.updateWebsiteChat(chat.id, { status: 'finished', finishedAt: now })
            await mixpanel.track('website-chat-finished', {
                distinct_id: chat.id,
                chatId: chat.id,
                messageCount: chat.messageCount,
                durationMinutes: Math.round((chat.lastMessageAt.getTime() - chat.startedAt.getTime()) / 60000),
                outcome: chat.enquirySubmitted ? 'enquiry' : 'none',
                model: chat.model,
                entryPage: chat.entryPage,
                // A resumed chat is reported again with its latest outcome; count conversations by unique chatId.
                resumed: chat.finishedAt !== undefined,
            })
        } catch (err) {
            logError('Failed to finish website chat', err, { chatId: chat.id })
        }
    }
}
