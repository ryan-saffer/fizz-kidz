// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { RootRedirect } from './root-redirect'

function CurrentPage() {
    const { pathname, search } = useLocation()
    return <div>{pathname + search}</div>
}

function renderRoot(url: string) {
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="*" element={<CurrentPage />} />
            </Routes>
        </MemoryRouter>
    )
}

afterEach(cleanup)

describe('RootRedirect', () => {
    it('sends the base route to the dashboard', () => {
        renderRoot('/')
        expect(screen.getByText('/dashboard')).toBeTruthy()
    })
    it('opens the page a Zoho CRM web tab puts in the query, with its own query', () => {
        renderRoot('/?/dashboard/bookings?parentName=Test%20Parent&zohoDealId=76392000014563148')
        expect(
            screen.getByText('/dashboard/bookings?parentName=Test%20Parent&zohoDealId=76392000014563148')
        ).toBeTruthy()
    })
    it('ignores other queries, and never leaves the portal', () => {
        renderRoot('/?ref=email')
        expect(screen.getByText('/dashboard')).toBeTruthy()
        cleanup()
        renderRoot('/?//example.com/phishing')
        expect(screen.getByText('/dashboard')).toBeTruthy()
    })
})
