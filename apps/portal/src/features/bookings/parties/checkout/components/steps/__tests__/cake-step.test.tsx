// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'

import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import type { TerminalCheckoutServer } from '@features/terminal-checkout/state/terminal-checkout-store'

import { useCheckoutStore, type CheckoutAnswers, type CheckoutConfig } from '../../../state/checkout-store'
import { CakeStep } from '../cake-step'

const config = {
    blocked: null,
    cake: {
        selection: 'Unicorn Ice-Cream Cake',
        serving: { supplies: ['Ice-cream cups', 'Spoons'], ordered: true },
        candles: { supplies: ['Candles'], ordered: false },
    },
} as unknown as CheckoutConfig

beforeEach(() => {
    useCheckoutStore.getState().open({ id: 'booking', location: 'werribee' } as WithId<FirestoreBooking>)
    // the checkout starts these from the party form: cups chosen, own candles
    useCheckoutStore.getState().init({
        config,
        answers: { cakeUsed: true, cakeServingUsed: true, cakeCandlesUsed: false },
        server: {} as TerminalCheckoutServer<CheckoutAnswers>,
    })
})

afterEach(() => {
    cleanup()
    useCheckoutStore.getState().close()
})

describe('CakeStep', () => {
    it('confirms the cake, cups and spoons, and candles separately, starting from the party form', async () => {
        render(<CakeStep />)

        expect(screen.getByText('Confirm that this cake was used.')).toBeTruthy()
        expect(screen.getByText(/Already paid in the party form/)).toBeTruthy()
        const cake = screen.getByRole('button', { name: /Unicorn Ice-Cream Cake/ })
        const serving = screen.getByRole('button', { name: /Ice-cream cups & Spoons/ })
        const candles = screen.getByRole('button', { name: /Candles/ })
        expect(cake.getAttribute('aria-pressed')).toBe('true')
        expect(serving.getAttribute('aria-pressed')).toBe('true')
        expect(candles.getAttribute('aria-pressed')).toBe('false')
        expect(screen.getByRole('heading', { name: 'Add-ons' })).toBeTruthy()
        expect(screen.getByText('Not chosen in the party form')).toBeTruthy()

        await userEvent.click(candles)
        await userEvent.click(serving)
        expect(useCheckoutStore.getState().answers).toMatchObject({
            cakeUsed: true,
            cakeServingUsed: false,
            cakeCandlesUsed: true,
        })
    })
})
