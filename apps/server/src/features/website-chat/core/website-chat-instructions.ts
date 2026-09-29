import additionalInfo from './prompt/additional-info.md'
import behaviour from './prompt/behaviour.md'
import persona from './prompt/persona.md'
import website from './prompt/website.md'

// Keep this string stable between requests so providers can cache it.
export const WEBSITE_CHAT_INSTRUCTIONS = [
    persona,
    behaviour,
    `# Website knowledge\n\n${website}`,
    `# Additional info\n\n${withoutComments(additionalInfo) || 'None yet.'}`,
].join('\n\n')

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

// Editor notes in the markdown files aren't part of the prompt.
function withoutComments(markdown: string) {
    return markdown.replace(/<!--[\s\S]*?-->/g, '').trim()
}
