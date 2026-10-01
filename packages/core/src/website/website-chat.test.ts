import { describe, expect, it } from 'vite-plus/test'

import { getWebsiteChatNudge } from './website-chat'

describe('getWebsiteChatNudge', () => {
    it('names the party package from the page', () => {
        expect(getWebsiteChatNudge({ path: '/birthday-parties/glam-parties/', partyPackageName: 'Glam' })).toEqual({
            messages: ['Checking out our Glam parties? 💜 Any questions I can help with?'],
            suggestions: ["What's included?", 'How much is it?', 'Book a party'],
        })
    })

    it('names the studio on a location page', () => {
        expect(getWebsiteChatNudge({ path: '/locations/essendon' })?.messages[0]).toBe(
            'Checking out our Essendon studio? Any questions I can help with?'
        )
    })

    it('matches the main service pages', () => {
        expect(getWebsiteChatNudge({ path: '/birthday-parties/at-home-parties/' })?.messages[0]).toContain(
            'party at home'
        )
        expect(getWebsiteChatNudge({ path: '/birthday-parties/' })?.messages[0]).toContain('Planning a birthday party?')
        expect(getWebsiteChatNudge({ path: '/holiday-programs/' })?.messages[0]).toContain('holiday programs')
        expect(getWebsiteChatNudge({ path: '/gift-cards/' })?.messages[0]).toBe(
            "Hi, I'm Frankie! 👋 Any questions I can help with?"
        )
    })

    it("doesn't interrupt people who are already enquiring", () => {
        expect(getWebsiteChatNudge({ path: '/contact-us/' })).toBeUndefined()
        expect(getWebsiteChatNudge({ path: '/birthday-parties/book-a-party' })).toBeUndefined()
    })
})
