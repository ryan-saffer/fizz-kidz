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

// Editor notes in the markdown files aren't part of the prompt.
function withoutComments(markdown: string) {
    return markdown.replace(/<!--[\s\S]*?-->/g, '').trim()
}
