// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { StaffUser } from '@fizz-kidz/core'

import { OrgProvider } from './org.provider'
import { useOrg } from './use-org'

let authUser: StaffUser | null = null

vi.mock('@session/use-auth', () => ({
    useAuth: () => authUser,
}))

function CurrentOrg() {
    const { currentOrg } = useOrg()
    return <div>{currentOrg}</div>
}

describe('OrgProvider', () => {
    beforeEach(() => {
        localStorage.clear()
        authUser = {
            uid: 'staff-user',
            email: 'staff@example.com',
            imageUrl: null,
            accountType: 'staff',
            roles: { balwyn: 'admin' },
        }
    })

    afterEach(() => {
        cleanup()
    })

    it('reconciles an unavailable cached organisation in state and storage', async () => {
        localStorage.setItem('selectedOrg', 'cheltenham')
        const view = render(
            <OrgProvider>
                <CurrentOrg />
            </OrgProvider>
        )

        expect(screen.getByText('balwyn')).toBeTruthy()
        await waitFor(() => expect(localStorage.getItem('selectedOrg')).toBe('balwyn'))

        authUser = {
            ...authUser!,
            roles: { balwyn: 'admin', cheltenham: 'admin' },
        }
        view.rerender(
            <OrgProvider>
                <CurrentOrg />
            </OrgProvider>
        )

        expect(screen.getByText('balwyn')).toBeTruthy()
    })
})
