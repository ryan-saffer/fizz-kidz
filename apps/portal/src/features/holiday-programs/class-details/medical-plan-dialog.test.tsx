// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { MedicalPlanDialog } from './medical-plan-dialog'

const mocks = vi.hoisted(() => ({ anaphylaxis: vi.fn(), asthma: vi.fn() }))
vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        holidayPrograms: {
            getAnaphylaxisPlanUrl: { mutationOptions: () => ({ mutationFn: mocks.anaphylaxis }) },
            getAsthmaActionPlanUrl: { mutationOptions: () => ({ mutationFn: mocks.asthma }) },
        },
    }),
}))

function renderReview(plans: Parameters<typeof MedicalPlanDialog>[0]['plans'], verify = true) {
    const onVerified = vi.fn()
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
            <MedicalPlanDialog
                childName="Child"
                plans={plans}
                onClose={vi.fn()}
                onVerified={verify ? onVerified : undefined}
            />
        </QueryClientProvider>
    )
    return onVerified
}

describe('medical plan verification', () => {
    beforeEach(() => {
        mocks.anaphylaxis.mockResolvedValue('https://example.com/anaphylaxis.pdf')
        mocks.asthma.mockResolvedValue('https://example.com/asthma.pdf')
    })
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('requires viewing and verifying both plans before signing a child in', async () => {
        const verified = renderReview([
            { type: 'anaphylaxis', reference: 'old-url' },
            { type: 'asthma', reference: 'asthma-path' },
        ])
        expect(screen.queryByRole('button', { name: 'Verified and sign in' })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'View anaphylaxis plan' }))
        await screen.findByTitle('Child anaphylaxis plan')
        fireEvent.click(screen.getByRole('button', { name: 'Verified, next plan' }))
        expect(verified).not.toHaveBeenCalled()
        expect(screen.queryByTitle('Child anaphylaxis plan')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /View asthma action plan/ }))
        await screen.findByTitle('Child asthma action plan')
        fireEvent.click(screen.getByRole('button', { name: 'Verified and sign in' }))
        expect(verified).toHaveBeenCalledOnce()
        expect(mocks.asthma).toHaveBeenCalledWith({ asthmaActionPlanUrl: 'asthma-path' }, expect.anything())
    })

    it('blocks sign-in on a failed load and allows retrying the asthma plan', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mocks.asthma.mockRejectedValueOnce(new Error('Unavailable'))
        const verified = renderReview([{ type: 'asthma', reference: 'asthma-path' }])
        fireEvent.click(screen.getByRole('button', { name: 'View asthma action plan' }))
        await screen.findByText('Unable to load the asthma action plan. Please try again.')
        expect((screen.getByRole('button', { name: 'Verified and sign in' }) as HTMLButtonElement).disabled).toBe(true)
        expect(verified).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: /Reload plan/ }))
        await screen.findByTitle('Child asthma action plan')
        await waitFor(() =>
            expect((screen.getByRole('button', { name: 'Verified and sign in' }) as HTMLButtonElement).disabled).toBe(
                false
            )
        )
    })

    it('does not offer sign-in when staff are only viewing a plan', async () => {
        renderReview([{ type: 'asthma', reference: 'asthma-path' }], false)
        fireEvent.click(screen.getByRole('button', { name: 'View asthma action plan' }))
        await screen.findByTitle('Child asthma action plan')
        expect(screen.queryByRole('button', { name: 'Verified and sign in' })).toBeNull()
    })
})
