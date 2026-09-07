// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PartyFormV2, PartyFormV2Checkout } from '@fizz-kidz/core'

import { PartyPayment, PartyPaymentRecovery } from './party-form-v2-payment'
import { readPartyPaymentAttempt } from './party-form-v2-payment-attempt'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), submit: vi.fn(), verification: vi.fn() }))
vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        parties: {
            preparePartyFormV2: { mutationOptions: () => ({ mutationFn: mocks.prepare }) },
            submitPartyFormV2: { mutationOptions: () => ({ mutationFn: mocks.submit }) },
        },
    }),
}))
vi.mock('react-square-web-payments-sdk', () => ({
    PaymentForm: ({
        cardTokenizeResponseReceived,
        createVerificationDetails,
    }: {
        cardTokenizeResponseReceived: (
            result: { status: string; token: string },
            verification: { token: string }
        ) => Promise<void>
        createVerificationDetails: () => unknown
    }) => (
        <button
            type="button"
            onClick={() => {
                mocks.verification(createVerificationDetails())
                void cardTokenizeResponseReceived({ status: 'OK', token: 'token' }, { token: 'verification' })
            }}
        >
            Pay card
        </button>
    ),
    CreditCard: () => null,
}))

const payload: PartyFormV2 = {
    bookingId: 'booking',
    parentFirstName: 'Alex',
    parentLastName: 'Smith',
    childName: 'Charlie',
    childAge: '7',
    numberOfChildren: '12 - 15',
    foodPackage: 'include',
    additions: [],
    creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'crunchySlime'] }],
    takeHomeBags: { lollyBags: 12 },
    products: {},
}
const quote: PartyFormV2Checkout = {
    submissionId: 'd8b234f7-a683-44f4-a958-a2ce61ae06d6',
    locationId: 'location',
    parentEmail: 'booked@example.com',
    subtotalCents: 10000,
    discountCents: 0,
    discountCode: '',
    totalCents: 10000,
    giftCardCents: 0,
    giftCardLast4: '',
    cardCents: 10000,
    items: [{ label: '12 × Lolly Bag', amountCents: 10000 }],
}
const completed = vi.fn()
const lock = vi.fn()
beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mocks.prepare.mockResolvedValue(quote)
    mocks.submit.mockResolvedValue({ status: 'completed', receiptUrl: 'https://receipt.example.com' })
})
afterEach(cleanup)
function setup() {
    render(
        <QueryClientProvider client={new QueryClient()}>
            <PartyPayment
                payload={payload}
                onSubmit={(action) => action()}
                onCompleted={completed}
                onLockChange={lock}
            />
        </QueryClientProvider>
    )
    return userEvent.setup()
}

describe('embedded party checkout', () => {
    it('applies discount and gift-card changes server-side and verifies only the remaining card amount', async () => {
        const user = setup()
        await screen.findByRole('button', { name: 'Pay card' })
        mocks.prepare.mockResolvedValueOnce({
            ...quote,
            discountCode: 'SAVE',
            discountCents: 1000,
            totalCents: 9000,
            cardCents: 9000,
        })
        await user.type(screen.getByLabelText('Discount Code'), 'SAVE')
        await user.click(screen.getByRole('button', { name: 'Apply discount' }))
        await screen.findByText("Discount code 'SAVE'")
        mocks.prepare.mockResolvedValueOnce({
            ...quote,
            discountCode: 'SAVE',
            discountCents: 1000,
            totalCents: 9000,
            giftCardCents: 4000,
            giftCardLast4: '1234',
            cardCents: 5000,
        })
        await user.type(screen.getByLabelText('Gift Card'), 'gift-number')
        await user.click(screen.getByRole('button', { name: 'Apply gift card' }))
        await screen.findByText('Gift card ending 1234')
        expect(mocks.prepare.mock.lastCall?.[0]).toMatchObject({
            payload,
            discountCode: 'SAVE',
            giftCardNumber: 'gift-number',
        })
        await user.click(screen.getByRole('button', { name: 'Pay card' }))
        await waitFor(() => expect(completed).toHaveBeenCalledWith('https://receipt.example.com'))
        expect(mocks.verification).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: '50.00',
                billingContact: { givenName: 'Alex', familyName: 'Smith', email: 'booked@example.com' },
            })
        )
        expect(mocks.submit.mock.calls[0][0]).toEqual({
            submissionId: quote.submissionId,
            token: 'token',
            buyerVerificationToken: 'verification',
        })
    })
    it('submits a full gift-card payment without mounting the card form', async () => {
        mocks.prepare.mockResolvedValue({ ...quote, giftCardCents: 10000, giftCardLast4: '1234', cardCents: 0 })
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay $100.00 with gift card' }))
        expect(screen.queryByRole('button', { name: 'Pay card' })).toBeNull()
        await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce())
        expect(mocks.submit.mock.calls[0][0].token).toBe('')
    })
    it('retries an ambiguous payment with the same submission and token, keeping editing locked', async () => {
        mocks.submit.mockResolvedValueOnce({ status: 'processing' })
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await user.click(await screen.findByRole('button', { name: 'Check payment status' }))
        await waitFor(() => expect(completed).toHaveBeenCalledOnce())
        expect(mocks.submit.mock.calls[1][0]).toEqual(mocks.submit.mock.calls[0][0])
        expect(lock).not.toHaveBeenCalledWith(false)
        expect(mocks.prepare).toHaveBeenCalledOnce()
    })
    it('requires a fresh order after a definitive decline and supports retrying the card', async () => {
        mocks.submit.mockRejectedValueOnce(
            Object.assign(new Error('Payment declined'), { data: { code: 'PAYMENT_METHOD_INVALID' } })
        )
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await screen.findByText('Payment declined')
        expect(lock).toHaveBeenCalledWith(false)
        mocks.prepare.mockResolvedValue({ ...quote, submissionId: 'f6e3709a-02a2-4c4d-9d32-f51c7b870ea9' })
        await user.click(screen.getByRole('button', { name: 'Refresh payment summary' }))
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await waitFor(() => expect(completed).toHaveBeenCalledOnce())
        expect(mocks.submit.mock.calls[1][0].submissionId).not.toBe(quote.submissionId)
    })

    it('leaves reconciliation and exposes refresh if a retry reveals a definite decline', async () => {
        mocks.submit
            .mockResolvedValueOnce({ status: 'processing' })
            .mockRejectedValueOnce(
                Object.assign(new Error('Card declined'), { data: { code: 'PAYMENT_METHOD_INVALID' } })
            )
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await user.click(await screen.findByRole('button', { name: 'Check payment status' }))
        expect(await screen.findByRole('button', { name: 'Refresh payment summary' })).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Check payment status' })).toBeNull()
        expect(readPartyPaymentAttempt(payload.bookingId)).toBeNull()
    })

    it('retains the original request across a reload and reconciles it without preparing another order', async () => {
        mocks.submit.mockResolvedValueOnce({ status: 'processing' })
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await screen.findByRole('button', { name: 'Check payment status' })
        const attempt = readPartyPaymentAttempt(payload.bookingId)!
        expect(attempt).toEqual({
            submissionId: quote.submissionId,
            token: 'token',
            buyerVerificationToken: 'verification',
        })
        cleanup()
        render(
            <QueryClientProvider client={new QueryClient()}>
                <PartyPaymentRecovery
                    bookingId={payload.bookingId}
                    input={attempt}
                    onCompleted={completed}
                    onReset={vi.fn()}
                />
            </QueryClientProvider>
        )
        await user.click(screen.getByRole('button', { name: 'Check payment status' }))
        await waitFor(() => expect(completed).toHaveBeenCalledOnce())
        expect(mocks.prepare).toHaveBeenCalledOnce()
        expect(mocks.submit.mock.calls[1][0]).toEqual(attempt)
        expect(readPartyPaymentAttempt(payload.bookingId)).toBeNull()
    })
})
