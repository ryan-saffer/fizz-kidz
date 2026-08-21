import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CreationInstructionsContent } from '@fizz-kidz/core'

import { CreationInstructions } from './creation-instructions'

describe('CreationInstructions', () => {
    it('renders structured instructions and resolved images', () => {
        const value: CreationInstructionsContent = [
            {
                _type: 'block',
                _key: 'heading',
                style: 'h2',
                markDefs: [],
                children: [{ _type: 'span', _key: 'heading-span', text: 'Morning session', marks: [] }],
            },
            {
                _type: 'block',
                _key: 'step',
                style: 'normal',
                listItem: 'number',
                level: 1,
                markDefs: [],
                children: [
                    { _type: 'span', _key: 'step-span', text: 'Mix the slime', marks: ['strong'] },
                    { _type: 'span', _key: 'step-note', text: ' carefully', marks: ['em'] },
                ],
            },
            {
                _type: 'externalImage',
                _key: 'image',
                url: 'https://example.com/slime.jpg',
                alt: 'Finished slime',
            },
            {
                _type: 'divider',
                _key: 'divider',
            },
        ]

        const html = renderToStaticMarkup(<CreationInstructions value={value} />)

        expect(html).toContain('class="fizz-creation-instructions"')
        expect(html).toContain('<h2>Morning session</h2>')
        expect(html).toContain('<ol>')
        expect(html).toContain('<strong>Mix the slime</strong>')
        expect(html).toContain('<em> carefully</em>')
        expect(html).toContain('src="https://example.com/slime.jpg"')
        expect(html).toContain('alt="Finished slime"')
        expect(html).toContain('<hr/>')
    })
})
