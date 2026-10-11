// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ProtectedRoute } from './protected-route'

let authUser: { uid: string } | null
let currentOrg: 'balwyn' | null

vi.mock('@session/use-auth', () => ({
    useAuth: () => authUser,
}))

vi.mock('@session/use-org', () => ({
    useOrg: () => ({
        currentOrg,
        hasPermission: () => true,
    }),
}))

vi.mock('./Unauthorised', () => ({
    default: ({ showLogout }: { showLogout?: boolean }) => (
        <div>{showLogout ? 'Access unavailable; sign out' : 'Access unavailable'}</div>
    ),
}))

function SignInPage() {
    const [searchParams] = useSearchParams()
    return <div>Sign in, then return to {searchParams.get('returnTo')}</div>
}

function renderProtectedRoute(path = '/protected') {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/sign-in" element={<SignInPage />} />
                <Route
                    path="/protected"
                    element={
                        <ProtectedRoute permission="dashboard:view">
                            <div>Protected content</div>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </MemoryRouter>
    )
}

describe('ProtectedRoute', () => {
    beforeEach(() => {
        authUser = null
        currentOrg = null
    })

    it('redirects signed-out users to sign in, returning them to the page and its query afterwards', () => {
        renderProtectedRoute('/protected?parentName=Jane%20Smith&zohoDealId=123')

        expect(
            screen.getByText('Sign in, then return to /protected?parentName=Jane%20Smith&zohoDealId=123')
        ).toBeTruthy()
    })

    it('does not redirect signed-in users without an organisation back to sign in', () => {
        authUser = { uid: 'staff-user' }

        renderProtectedRoute()

        expect(screen.getByText('Access unavailable; sign out')).toBeTruthy()
    })

    it('renders protected content for a permitted organisation user', () => {
        authUser = { uid: 'staff-user' }
        currentOrg = 'balwyn'

        renderProtectedRoute()

        expect(screen.getByText('Protected content')).toBeTruthy()
    })
})
