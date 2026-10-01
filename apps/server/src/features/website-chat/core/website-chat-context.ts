import type { ModelMessage, UIMessage, UserModelMessage } from 'ai'

// Marks the context note so it can be told apart from what the customer wrote, e.g. when building transcripts.
export const CONTEXT_NOTE_PREFIX = '[Context for Frankie, not written by the customer]'

/** Today's date, the visitor's page and the greeting they saw. */
export function getWebsiteChatPageContext({ pagePath, greeting }: { pagePath?: string; greeting?: string }) {
    const today = new Date().toLocaleDateString('en-AU', {
        timeZone: 'Australia/Melbourne',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
    return [
        `Today is ${today}.`,
        pagePath && `The visitor is on https://www.fizzkidz.com.au${pagePath}`,
        greeting && `The chat opened with this greeting from you: "${greeting}"`,
    ]
        .filter(Boolean)
        .join('\n')
}

/**
 * Adds the context to the customer's latest message rather than the system prompt. The date, page and greeting
 * change during a chat, and anything in the prompt after a change can't be served from the provider's cache.
 */
export function withContextNote(messages: ModelMessage[], context: string): ModelMessage[] {
    const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user')
    return messages.map((message, index) => {
        if (index !== lastUserIndex) return message
        const { content } = message as UserModelMessage
        const parts = typeof content === 'string' ? [{ type: 'text' as const, text: content }] : content
        return { ...message, content: [...parts, { type: 'text', text: `${CONTEXT_NOTE_PREFIX}\n${context}` }] }
    }) as ModelMessage[]
}

// How much of the conversation the model sees. The whole conversation is still saved as the transcript.
export const WEBSITE_CHAT_MODEL_HISTORY = 60

/**
 * The latest messages of a long chat, so each reply's cost and speed stay steady however long it runs.
 * Starts on a customer message, so the model never sees a reply without what it was replying to.
 */
export function withRecentHistory(messages: UIMessage[], limit = WEBSITE_CHAT_MODEL_HISTORY) {
    if (messages.length <= limit) return messages
    const recent = messages.slice(-limit)
    const firstCustomerMessage = recent.findIndex((message) => message.role === 'user')
    return firstCustomerMessage === -1 ? recent : recent.slice(firstCustomerMessage)
}
