import path from 'path'

import { createCanvas, registerFont } from 'canvas'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { fitFont } from './invitation-image-generator'

vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))

describe('fitFont', () => {
    const ctx = createCanvas(10, 10).getContext('2d')

    beforeAll(() => {
        registerFont(path.resolve(__dirname, '../../invitations/fonts/petit-cochon.ttf'), { family: 'petit-cochon' })
    })

    it('keeps the design font when the text already fits', () => {
        expect(fitFont(ctx, "Mia's 5th", '160px petit-cochon', 910)).toBe('160px petit-cochon')
    })

    it('shrinks the font so long names fit on one line', () => {
        const font = fitFont(ctx, "Lachie and Matthew's 6th", '160px petit-cochon', 910)

        expect(font).toMatch(/^\d+px petit-cochon$/)
        expect(font).not.toBe('160px petit-cochon')
        ctx.font = font
        expect(ctx.measureText("Lachie and Matthew's 6th").width).toBeLessThanOrEqual(910)
    })
})
