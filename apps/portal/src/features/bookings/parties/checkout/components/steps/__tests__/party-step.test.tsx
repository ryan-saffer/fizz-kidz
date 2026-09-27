// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'

import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import { useCheckoutStore, type CheckoutConfig, type CheckoutServer } from '../../../state/checkout-store'
import { PartyStep } from '../party-step'

const config = {
    blocked: null,
    payment: null,
    customerEmail: 'jane@example.com',
    minChildren: 12,
    bookedChildren: '',
    partyPrices: [
        { partyLength: '1.5', includesFood: true, name: '1.5 Hour Party', priceCents: 4700, imageUrl: null },
        { partyLength: '1.5', includesFood: false, name: '1.5 Hour Party', priceCents: 4000, imageUrl: null },
        { partyLength: '2', includesFood: true, name: '2 Hour Party', priceCents: 6000, imageUrl: null },
        { partyLength: '2', includesFood: false, name: '2 Hour Party', priceCents: 5300, imageUrl: null },
    ],
    additions: [],
    prefill: { partyLength: '1.5', includesFood: true, childrenCount: 12, additions: [] },
} as CheckoutConfig

beforeEach(() => {
    useCheckoutStore.getState().open({ id: 'booking', location: 'balwyn' } as WithId<FirestoreBooking>)
    useCheckoutStore.getState().init({ config, server: {} as CheckoutServer })
})

afterEach(() => {
    cleanup()
    useCheckoutStore.getState().close()
})

describe('PartyStep', () => {
    it('lets staff clear the number of children and type a new one', async () => {
        render(<PartyStep />)
        const input = screen.getByLabelText('Children who came') as HTMLInputElement

        await userEvent.click(input)
        await userEvent.keyboard('{Backspace}')
        expect(input.value).toBe('')
        await userEvent.keyboard('24')

        expect(input.value).toBe('24')
        expect(useCheckoutStore.getState().answers.childrenCount).toBe(24)
    })

    it('puts the number back when the field is left empty', async () => {
        render(<PartyStep />)
        const input = screen.getByLabelText('Children who came') as HTMLInputElement

        await userEvent.clear(input)
        await userEvent.tab()

        expect(input.value).toBe('12')
        expect(useCheckoutStore.getState().answers.childrenCount).toBe(12)
    })
})
