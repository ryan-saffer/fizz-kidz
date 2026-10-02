import { WebsiteStudioOptions } from '@fizz-kidz/core'

// How Frankie opens a chat: the default greeting, and the page-specific speech bubble that can open it instead.
// The widget sends whichever greeting it showed with each message, so the server only ever sees it as text.

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
