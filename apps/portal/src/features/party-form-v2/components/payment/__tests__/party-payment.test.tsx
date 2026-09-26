// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PartyFormV2, PartyFormV2Checkout } from '@fizz-kidz/core'

import { useCreatePartyForm } from '../../../state/form'
import { usePartyFormStore, type PartyFormV2Config } from '../../../state/party-form-store'
import { PartyPayment } from '../party-payment'
import { PaymentStatus } from '../payment-status'

const mocks = vi.hoisted(() => ({
    prepare: vi.fn(),
    submit: vi.fn(),
    verification: vi.fn(),
    paymentRequest: vi.fn(),
}))
vi.mock('react-square-web-payments-sdk', () => ({
    PaymentForm: ({
        cardTokenizeResponseReceived,
        createVerificationDetails,
        createPaymentRequest,
    }: {
        cardTokenizeResponseReceived: (
            result: { status: string; token: string },
            verification?: { token: string }
        ) => Promise<void>
        createVerificationDetails: () => unknown
        createPaymentRequest: () => unknown
    }) => (
        <>
            <button
                type="button"
                onClick={() => {
                    mocks.verification(createVerificationDetails())
                    void cardTokenizeResponseReceived({ status: 'OK', token: 'token' }, { token: 'verification' })
                }}
            >
                Pay card
            </button>
            <button
                type="button"
                onClick={() => {
                    mocks.paymentRequest(createPaymentRequest())
                    void cardTokenizeResponseReceived({ status: 'OK', token: 'wallet-token' })
                }}
            >
                Pay with wallet
            </button>
        </>
    ),
    CreditCard: () => null,
    ApplePay: () => null,
    GooglePay: () => null,
}))

const config = {
    bookingId: 'booking',
    type: 'studio',
    cakeOptions: null,
    creationsRequired: 2,
    prefill: {
        parentFirstName: 'Alex',
        parentLastName: 'Smith',
        childName: 'Charlie',
        childAge: '7',
        includesFood: true,
    },
    alreadyPurchased: { cake: null, takeHomeBags: {}, products: {} },
    packages: [],
    additions: [],
    takeHomeOptions: null,
} satisfies PartyFormV2Config
const payload: PartyFormV2 = { mode: 'cake', bookingId: 'booking', takeHomeBags: { lollyBags: 12 }, products: {} }
const quote: PartyFormV2Checkout = {
    checkoutId: 'square-order',
    locationId: 'location',
    customerEmail: 'booked@example.com',
    subtotalCents: 10000,
    discountCents: 0,
    discountCode: '',
    totalCents: 10000,
    giftCardCents: 0,
    giftCardLast4: '',
    cardCents: 10000,
    items: [{ label: '12 × Lolly Bag', amountCents: 10000 }],
}
const stored = () => JSON.parse(sessionStorage.getItem('party-form-payment:booking') ?? 'null')
const completed = () => usePartyFormStore.getState().stage === 'complete'
const locked = () => usePartyFormStore.getState().attempt !== null

beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mocks.prepare.mockResolvedValue(quote)
    mocks.submit.mockResolvedValue({ status: 'completed', receiptUrl: 'https://receipt.example.com' })
})
afterEach(cleanup)

/** Sets up the store as `PartyForm` does, with 12 lolly bags on the cake form, and opens the review step's payment. */
function Checkout() {
    const form = useCreatePartyForm(config)
    const ready = usePartyFormStore((state) => state.form === form)
    const stage = usePartyFormStore((state) => state.stage)
    useLayoutEffect(() => {
        form.setFieldValue('takeHomeBags.lollyBags', 12)
        usePartyFormStore
            .getState()
            .init({ config, mode: 'cake', form, server: { prepare: mocks.prepare, submit: mocks.submit } })
        const { stage, steps, goTo } = usePartyFormStore.getState()
        if (stage === 'welcome') goTo(steps.length - 1)
    }, [form])
    if (!ready) return null
    return stage === 'recovery' ? <PaymentStatus /> : <PartyPayment />
}
function setup() {
    render(<Checkout />)
    return userEvent.setup()
}

describe('embedded party checkout', () => {
    it('offers Apple Pay and Google Pay for the server-priced card amount, without buyer verification', async () => {
        mocks.prepare.mockResolvedValue({
            ...quote,
            discountCode: 'SAVE',
            discountCents: 1000,
            totalCents: 9000,
            giftCardCents: 4000,
            giftCardLast4: '1234',
            cardCents: 5000,
        })
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay with wallet' }))
        await waitFor(() => expect(completed()).toBe(true))
        expect(usePartyFormStore.getState().receiptUrl).toBe('https://receipt.example.com')
        expect(mocks.paymentRequest).toHaveBeenCalledWith({
            countryCode: 'AU',
            currencyCode: 'AUD',
            lineItems: [{ label: '12 × Lolly Bag', amount: '100.00' }],
            discounts: [
                { label: "Discount code 'SAVE'", amount: '10.00' },
                { label: 'Gift card ending 1234', amount: '40.00' },
            ],
            total: { label: 'Fizz Kidz', amount: '50.00' },
        })
        expect(mocks.submit.mock.calls[0][0]).toEqual({
            payload,
            checkoutId: 'square-order',
            token: 'wallet-token',
            buyerVerificationToken: '',
        })
    })

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
        await waitFor(() => expect(completed()).toBe(true))
        expect(usePartyFormStore.getState().receiptUrl).toBe('https://receipt.example.com')
        expect(mocks.verification).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: '50.00',
                billingContact: { givenName: 'Alex', familyName: 'Smith', email: 'booked@example.com' },
            })
        )
        expect(mocks.submit.mock.calls[0][0]).toEqual({
            payload,
            checkoutId: 'square-order',
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
    it('retries an ambiguous payment with the same request, keeping editing locked until it completes', async () => {
        mocks.submit.mockResolvedValueOnce({ status: 'processing' })
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await screen.findByRole('button', { name: 'Check payment status' })
        expect(locked()).toBe(true)
        await user.click(screen.getByRole('button', { name: 'Check payment status' }))
        await waitFor(() => expect(completed()).toBe(true))
        expect(mocks.submit.mock.calls[1][0]).toEqual(mocks.submit.mock.calls[0][0])
        expect(locked()).toBe(false)
        expect(mocks.prepare).toHaveBeenCalledOnce()
    })
    it('asks the customer to contact us, not pay again, when a payment stays unconfirmed', async () => {
        mocks.submit.mockResolvedValue({ status: 'processing' })
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        for (let check = 0; check < 2; check++)
            await user.click(await screen.findByRole('button', { name: 'Check payment status' }))
        expect(await screen.findByText(/taking longer than expected/)).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Check payment status' })).toBeTruthy()
    })
    it('requires a fresh order after a definitive decline and supports retrying the card', async () => {
        mocks.submit.mockRejectedValueOnce(
            Object.assign(new Error('Payment declined'), { data: { code: 'PAYMENT_METHOD_INVALID' } })
        )
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await screen.findByText('Payment declined')
        expect(locked()).toBe(false)
        mocks.prepare.mockResolvedValue({ ...quote, checkoutId: 'new-square-order' })
        await user.click(screen.getByRole('button', { name: 'Refresh payment summary' }))
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await waitFor(() => expect(completed()).toBe(true))
        expect(mocks.submit.mock.calls[1][0].checkoutId).toBe('new-square-order')
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
        expect(stored()).toBeNull()
    })

    it('retains the original request across a reload and reconciles it without preparing another order', async () => {
        mocks.submit.mockResolvedValueOnce({ status: 'processing' })
        const user = setup()
        await user.click(await screen.findByRole('button', { name: 'Pay card' }))
        await screen.findByRole('button', { name: 'Check payment status' })
        const attempt = stored()
        expect(attempt).toEqual({
            payload,
            checkoutId: 'square-order',
            token: 'token',
            buyerVerificationToken: 'verification',
        })
        cleanup()
        render(<Checkout />)
        await user.click(screen.getByRole('button', { name: 'Check payment status' }))
        await waitFor(() => expect(completed()).toBe(true))
        expect(mocks.prepare).toHaveBeenCalledOnce()
        expect(mocks.submit.mock.calls[1][0]).toEqual(attempt)
        expect(stored()).toBeNull()
    })
})
