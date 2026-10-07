import { describe, expect, it } from 'vite-plus/test'

import { splitWebsiteChatBubbles } from './website-chat'

describe('splitWebsiteChatBubbles', () => {
    it('makes each paragraph its own bubble', () => {
        expect(
            splitWebsiteChatBubbles(
                'Parents are welcome to stay! 🎉\n\nOur studios fit 40 people in total.\n\nWhich studio are you thinking of?'
            )
        ).toEqual([
            'Parents are welcome to stay! 🎉',
            'Our studios fit 40 people in total.',
            'Which studio are you thinking of?',
        ])
    })

    it('keeps a list with the message that introduces it', () => {
        expect(
            splitWebsiteChatBubbles('We have three studios:\n\n- Balwyn\n\n- Essendon\n\nWhich is closest?')
        ).toEqual(['We have three studios:\n\n- Balwyn\n\n- Essendon', 'Which is closest?'])
    })

    it('ignores a paragraph break still streaming in', () => {
        expect(splitWebsiteChatBubbles('Lovely!\n\n')).toEqual(['Lovely!'])
    })
})
