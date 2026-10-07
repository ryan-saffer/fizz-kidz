import { z } from 'zod'

// AI Gateway model IDs the website chat may use. The widget sends one of these so we can compare models side by side.
// Models labelled "(paid credits)" aren't on the AI Gateway free tier (checked 2026-09-30); the rest are.
export const WebsiteChatModelOptions = [
    { value: 'openai/gpt-6-luna', label: 'GPT-6 Luna (paid credits)' },
    { value: 'openai/gpt-5.4-nano', label: 'GPT-5.4 Nano' },
    { value: 'spacexai/grok-4.1-fast-non-reasoning', label: 'Grok 4.1 Fast' },
    { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5 (paid credits)' },
    { value: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna (paid credits)' },
    { value: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash (paid credits)' },
] as const

export type WebsiteChatModel = (typeof WebsiteChatModelOptions)[number]['value']

export const DEFAULT_WEBSITE_CHAT_MODEL: WebsiteChatModel = 'openai/gpt-6-luna'

export const WebsiteChatModelSchema = z.enum(
    WebsiteChatModelOptions.map(({ value }) => value) as [WebsiteChatModel, ...WebsiteChatModel[]]
)

// A ceiling that only stops abuse. Long chats are fine: the model sees just the latest messages (see the server).
export const WEBSITE_CHAT_MAX_MESSAGES = 300
/** Applies to what the customer types; Frankie's replies are limited by the model's output cap instead. */
export const WEBSITE_CHAT_MAX_MESSAGE_LENGTH = 2000

// A conversation with no new message for this long is finished and reported.
export const WEBSITE_CHAT_IDLE_MINUTES = 30

// What Frankie is told when the customer taps a button on the enquiry details instead of Send enquiry. The server also
// checks for Don't send, so a customer who taps it is never followed up.
export const WEBSITE_CHAT_CHANGE_SOMETHING_REASON = 'The customer tapped Change something, so nothing was sent.'
export const WEBSITE_CHAT_DONT_SEND_REASON =
    "The customer tapped Don't send. Nothing was sent, and they don't want the team to follow up."

export const WebsiteChatIdSchema = z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)

export type WebsiteChatTranscriptMessage = {
    role: 'customer' | 'frankie'
    text: string
    /** ISO timestamp. Chats saved before timestamps were recorded don't have one. */
    sentAt?: string
}

export type WebsiteChat = {
    id: string
    status: 'active' | 'finished'
    model: WebsiteChatModel
    entryPage: string | null
    startedAt: Date
    lastMessageAt: Date
    /** When it last finished. Kept when a finished chat resumes, until it finishes again. */
    finishedAt?: Date
    /** Messages sent by the customer. */
    messageCount: number
    enquirySubmitted: boolean
    messages: WebsiteChatTranscriptMessage[]
}

const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/

/**
 * Frankie writes like she's texting, with a blank line between messages, so each paragraph of a reply is its own chat
 * bubble. A list stays in the bubble that introduces it. Shared by the website chat and the Portal's transcripts, so
 * the team reads a chat the way the customer did.
 */
export function splitWebsiteChatBubbles(text: string) {
    return text
        .split(/\n\s*\n/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .reduce<string[]>((bubbles, chunk) => {
            if (LIST_ITEM.test(chunk) && bubbles.length > 0) {
                bubbles[bubbles.length - 1] += `\n\n${chunk}`
            } else {
                bubbles.push(chunk)
            }
            return bubbles
        }, [])
}
