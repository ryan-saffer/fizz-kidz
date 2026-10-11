// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { PartyComplete } from '../party-complete'

afterEach(cleanup)

describe('party form confirmation', () => {
    it('celebrates the party and links to the receipt when something was paid', () => {
        render(
            <PartyComplete
                mode="party"
                parentFirstName="Alex"
                childName="Charlie"
                receiptUrl="https://receipt.example.com"
            />
        )
        expect(screen.getByRole('heading', { name: "You're all set, Alex!" })).toBeTruthy()
        expect(screen.getByText("We can't wait to celebrate Charlie's birthday with you.")).toBeTruthy()
        expect(screen.getByRole('link', { name: /View payment receipt/ }).getAttribute('href')).toBe(
            'https://receipt.example.com'
        )
        expect(screen.getByText(/ready on the day/)).toBeTruthy()
    })

    it('skips the payment steps when nothing was charged', () => {
        render(<PartyComplete mode="party" parentFirstName="Alex" childName="Charlie" receiptUrl={null} />)
        expect(screen.queryByRole('link', { name: /View payment receipt/ })).toBeNull()
        expect(screen.queryByText(/ready on the day/)).toBeNull()
        expect(screen.getByText(/paid for at the end of the party/)).toBeTruthy()
    })

    it('confirms a cake form order and mentions the party form still to come', () => {
        render(
            <PartyComplete
                mode="cake"
                parentFirstName="Alex"
                childName="Charlie"
                receiptUrl="https://receipt.example.com"
            />
        )
        expect(screen.getByRole('heading', { name: 'Your order is in, Alex!' })).toBeTruthy()
        expect(screen.getByText(/send you the party form closer to the day/)).toBeTruthy()
    })
})
