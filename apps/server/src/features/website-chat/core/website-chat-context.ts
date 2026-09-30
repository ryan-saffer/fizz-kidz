import type { ModelMessage, UserModelMessage } from 'ai'

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
