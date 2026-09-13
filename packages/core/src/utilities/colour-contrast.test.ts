import { describe, expect, it } from 'vitest'

import { getAccessibleTextColour, getColourContrastRatio, getReadableTextColour } from './colour-contrast'

describe('colour contrast utilities', () => {
    it('calculates the WCAG contrast ratio', () => {
        expect(getColourContrastRatio('#000000', '#FFFFFF')).toBe(21)
    })

    it('keeps a colour that already meets the requested contrast', () => {
        expect(getAccessibleTextColour('#542785', '#FFFFFF')).toBe('#542785')
    })

    it('darkens a colour until it meets the requested contrast', () => {
        const result = getAccessibleTextColour('#4CC5D9', '#FFFFFF')
        expect(getColourContrastRatio(result, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    })

    it('uses white text on dark backgrounds', () => {
        expect(getReadableTextColour('#542785')).toBe('#FFFFFF')
    })

    it('uses dark text on bright backgrounds', () => {
        expect(getReadableTextColour('#4CC5D9')).toBe('#19131F')
    })
})
