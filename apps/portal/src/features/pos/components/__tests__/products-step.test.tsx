// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'

import type { TerminalCheckoutServer } from '@features/terminal-checkout/state/terminal-checkout-store'

import { usePosStore, type PosAnswers } from '../../state/pos-store'
import { ProductsStep } from '../products-step'

const products = [
    { variationId: 'slime', name: 'String Slime Kit', description: null, imageUrl: null, priceCents: 1995 },
    { variationId: 'soap', name: 'Soap Making Kit', description: null, imageUrl: null, priceCents: 1995 },
]

beforeEach(() => {
    usePosStore.getState().open('balwyn')
    usePosStore.getState().init({ config: { products }, server: {} as TerminalCheckoutServer<PosAnswers> })
})

afterEach(() => {
    cleanup()
    usePosStore.getState().close()
})

describe('ProductsStep', () => {
    it('adds a product with a tap and sets how many', async () => {
        render(<ProductsStep />)
        expect(screen.queryByRole('button', { name: 'One less String Slime Kit' })).toBeNull()

        await userEvent.click(screen.getByRole('button', { name: 'Add String Slime Kit' }))
        await userEvent.click(screen.getByRole('button', { name: 'One more String Slime Kit' }))
        await userEvent.click(screen.getByRole('button', { name: 'Add Soap Making Kit' }))
        expect(usePosStore.getState().answers.items).toEqual([
            { variationId: 'slime', quantity: 2 },
            { variationId: 'soap', quantity: 1 },
        ])

        await userEvent.click(screen.getByRole('button', { name: 'One less Soap Making Kit' }))
        expect(usePosStore.getState().answers.items).toEqual([{ variationId: 'slime', quantity: 2 }])
    })
})
