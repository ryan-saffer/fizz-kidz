import { z } from 'zod'

import { WebsiteStudioOptions } from './website-forms'

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

// After this much browsing in a visit, Frankie offers help in a speech bubble (once per visit).
export const WEBSITE_CHAT_NUDGE_DELAY_SECONDS = 40

// Pages where people are already enquiring, so Frankie doesn't interrupt.
const WEBSITE_CHAT_NUDGE_EXCLUDED_PATHS = ['/contact-us/', '/birthday-parties/book-a-party/']

export type WebsiteChatGreeting = {
    /** Shown one after another, each in its own bubble. */
    messages: string[]
    suggestions: string[]
}

/** How Frankie opens a new chat. */
export const DEFAULT_WEBSITE_CHAT_GREETING: WebsiteChatGreeting = {
    messages: [
        'Hi, welcome to Fizz Kidz!',
        "I'm Frankie. AI with a bit of Fizz. 💜",
        'What can I help with today? Ask me anything, or I can help you get a booking started. ✨',
    ],
    suggestions: ['I have a question', 'Make a booking', 'Just browsing'],
}

const PARTY_SUGGESTIONS = ["What's included?", 'How much is it?', 'Book a party']

/** The speech bubble Frankie shows on a page, which becomes the chat greeting if opened. */
export function getWebsiteChatNudge({
    path,
    partyPackageName,
}: {
    path: string
    partyPackageName?: string
}): WebsiteChatGreeting | undefined {
    const normalisedPath = path.endsWith('/') ? path : `${path}/`
    if (WEBSITE_CHAT_NUDGE_EXCLUDED_PATHS.includes(normalisedPath)) return undefined

    if (partyPackageName) {
        return {
            messages: [`Checking out our ${partyPackageName} parties? 💜 Any questions I can help with?`],
            suggestions: PARTY_SUGGESTIONS,
        }
    }

    if (normalisedPath === '/birthday-parties/at-home-parties/') {
        return {
            messages: ['Thinking about a party at home? 🏡 Any questions I can help with?'],
            suggestions: PARTY_SUGGESTIONS,
        }
    }

    if (normalisedPath.startsWith('/birthday-parties/')) {
        return {
            messages: ['Planning a birthday party? 🎉 Any questions I can help with?'],
            suggestions: PARTY_SUGGESTIONS,
        }
    }

    if (normalisedPath === '/holiday-programs/') {
        return {
            messages: ['Checking out our holiday programs? Any questions I can help with?'],
            suggestions: ['When are they on?', 'How much is it?', 'How do I book?'],
        }
    }

    const studio = WebsiteStudioOptions.find(({ value }) => normalisedPath === `/locations/${value}/`)
    if (studio) {
        return {
            messages: [`Checking out our ${studio.label} studio? Any questions I can help with?`],
            suggestions: ['Birthday parties', 'Holiday programs', 'Something else'],
        }
    }

    return {
        messages: ["Hi, I'm Frankie! 👋 Any questions I can help with?"],
        suggestions: ['Birthday party', 'Holiday programs', 'Something else'],
    }
}
