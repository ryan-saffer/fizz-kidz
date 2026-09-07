import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { CreditCard, PaymentForm } from 'react-square-web-payments-sdk'

import {
    partyFormV2RequiresPayment,
    type PartyFormV2,
    type PartyFormV2Checkout,
    type SubmitPartyFormV2,
} from '@fizz-kidz/core'

import { SQUARE_APPLICATION_ID } from '@integrations/square'
import { useTRPC } from '@integrations/trpc'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'

import { clearPartyPaymentAttempt, savePartyPaymentAttempt } from './party-form-v2-payment-attempt'

type Props = {
    payload: PartyFormV2
    onSubmit: (action: () => Promise<void>) => Promise<void>
    onCompleted: (receiptUrl: string | null) => void
    onLockChange: (locked: boolean) => void
}

/** The form only supplies answers. All charge amounts come from the prepared server order. */
export function PartyPayment({ payload, onSubmit, onCompleted, onLockChange }: Props) {
    const trpc = useTRPC()
    const { mutateAsync: prepare } = useMutation(trpc.parties.preparePartyFormV2.mutationOptions())
    const { mutateAsync: submit, isPending } = useMutation(trpc.parties.submitPartyFormV2.mutationOptions())
    const [checkout, setCheckout] = useState<PartyFormV2Checkout | null>(null)
    const [discountCode, setDiscountCode] = useState('')
    const [giftCardNumber, setGiftCardNumber] = useState('')
    const [applied, setApplied] = useState({ discountCode: '', giftCardNumber: '' })
    const [preparing, setPreparing] = useState(true)
    const [error, setError] = useState('')
    const [processing, setProcessing] = useState(false)
    const [needsRefresh, setNeedsRefresh] = useState(false)
    const attempt = useRef<SubmitPartyFormV2 | null>(null)
    const inFlight = useRef(false)
    const activeCheckout = useRef<string | null>(null)
    const payloadKey = JSON.stringify(payload)

    useEffect(() => {
        activeCheckout.current = checkout?.submissionId ?? null
        return () => {
            activeCheckout.current = null
        }
    }, [checkout?.submissionId])

    useEffect(() => {
        let active = true
        setPreparing(true)
        setCheckout(null)
        setError('')
        void prepare({ payload: JSON.parse(payloadKey) as PartyFormV2, ...applied })
            .then((result) => {
                if (active) setCheckout(result)
            })
            .catch((err: Error) => {
                if (active) setError(err.message)
            })
            .finally(() => {
                if (active) setPreparing(false)
            })
        return () => {
            active = false
        }
    }, [payloadKey, applied, prepare])

    function refresh() {
        attempt.current = null
        setNeedsRefresh(false)
        setApplied({ ...applied })
    }

    async function pay(token = '', buyerVerificationToken = '') {
        if (
            !checkout ||
            activeCheckout.current !== checkout.submissionId ||
            preparing ||
            inFlight.current ||
            needsRefresh
        )
            return
        attempt.current ??= { submissionId: checkout.submissionId, token, buyerVerificationToken }
        const input = attempt.current
        try {
            savePartyPaymentAttempt(payload.bookingId, input)
        } catch {
            setError('Unable to save the payment attempt in this browser. Please enable session storage and try again.')
            return
        }
        inFlight.current = true
        onLockChange(true)
        setError('')
        try {
            let submitted = false
            await onSubmit(async () => {
                submitted = true
                const result = await submit(input)
                if (result.status === 'completed') {
                    clearPartyPaymentAttempt(payload.bookingId)
                    onCompleted(result.receiptUrl)
                } else setProcessing(true)
            })
            if (!submitted) {
                clearPartyPaymentAttempt(payload.bookingId)
                attempt.current = null
                onLockChange(false)
            }
        } catch (err) {
            const failure = err as { message?: string; data?: { code?: string } }
            const definitive = [
                'BAD_REQUEST',
                'PAYMENT_METHOD_INVALID',
                'GIFT_CARD_INACTIVE',
                'DISCOUNT_CODE_ALREADY_REDEEMED',
            ].includes(failure.data?.code ?? '')
            setError(failure.message ?? 'Unable to complete payment.')
            if (definitive) {
                clearPartyPaymentAttempt(payload.bookingId)
                setProcessing(false)
                setNeedsRefresh(true)
                onLockChange(false)
            } else {
                // A lost response may follow a successful charge. Retry the same order and token.
                setProcessing(true)
            }
        } finally {
            inFlight.current = false
        }
    }

    if (processing)
        return (
            <section className="party-section" aria-live="polite">
                <h2 className="font-lilita text-2xl">Finalising your party details</h2>
                <p className="my-4">Please keep this page open while we confirm your payment and party details.</p>
                {error && (
                    <p role="alert" className="mb-4 text-red-600">
                        {error}
                    </p>
                )}
                <Button type="button" disabled={isPending} onClick={() => void pay()}>
                    Check payment status
                </Button>
            </section>
        )

    return (
        <section className="party-section party-checkout" aria-label="Payment">
            <h2 className="font-lilita text-2xl">Payment</h2>
            <fieldset disabled={preparing || isPending} className="min-w-0">
                {partyFormV2RequiresPayment(payload) && (
                    <div className="my-5 grid gap-5">
                        <div>
                            <Label htmlFor="party-discount-code">Discount Code</Label>
                            <div className="mt-2 flex gap-2">
                                <Input
                                    id="party-discount-code"
                                    value={discountCode}
                                    onChange={(event) => setDiscountCode(event.target.value)}
                                />
                                <Button
                                    type="button"
                                    disabled={!discountCode.trim()}
                                    onClick={() => setApplied({ ...applied, discountCode: discountCode.trim() })}
                                >
                                    Apply discount
                                </Button>
                            </div>
                            {applied.discountCode && (
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => {
                                        setApplied({ ...applied, discountCode: '' })
                                        setDiscountCode('')
                                    }}
                                >
                                    Remove discount
                                </Button>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="party-gift-card">Gift Card</Label>
                            <div className="mt-2 flex gap-2">
                                <Input
                                    id="party-gift-card"
                                    autoComplete="off"
                                    value={giftCardNumber}
                                    onChange={(event) => setGiftCardNumber(event.target.value)}
                                />
                                <Button
                                    type="button"
                                    disabled={!giftCardNumber.trim()}
                                    onClick={() => setApplied({ ...applied, giftCardNumber: giftCardNumber.trim() })}
                                >
                                    Apply gift card
                                </Button>
                            </div>
                            {applied.giftCardNumber && (
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => {
                                        setApplied({ ...applied, giftCardNumber: '' })
                                        setGiftCardNumber('')
                                    }}
                                >
                                    Remove gift card
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </fieldset>
            {preparing && (
                <p role="status" className="my-4">
                    Updating payment summary...
                </p>
            )}
            {error && (
                <p role="alert" className="my-4 text-red-600">
                    {error}
                </p>
            )}
            {(!checkout || needsRefresh) && !preparing && (
                <Button type="button" onClick={refresh}>
                    Refresh payment summary
                </Button>
            )}
            {checkout && !preparing && (
                <>
                    <dl className="party-checkout-totals">
                        {checkout.items.map((item, index) => (
                            <div key={`${item.label}-${index}`}>
                                <dt>{item.label}</dt>
                                <dd>{money(item.amountCents)}</dd>
                            </div>
                        ))}
                        <div>
                            <dt>Subtotal</dt>
                            <dd>{money(checkout.subtotalCents)}</dd>
                        </div>
                        {checkout.discountCode && (
                            <div>
                                <dt>Discount code '{checkout.discountCode}'</dt>
                                <dd>-{money(checkout.discountCents)}</dd>
                            </div>
                        )}
                        {checkout.giftCardCents > 0 && (
                            <div>
                                <dt>Gift card ending {checkout.giftCardLast4}</dt>
                                <dd>-{money(checkout.giftCardCents)}</dd>
                            </div>
                        )}
                        <div className="font-semibold">
                            <dt>To pay by card</dt>
                            <dd>{money(checkout.cardCents)}</dd>
                        </div>
                    </dl>
                    <p className="my-5 text-sm text-muted-foreground">
                        The rest of your party payment will be made at the end of the party.
                    </p>
                    {isPending ? (
                        <p role="status">Processing payment...</p>
                    ) : (
                        !needsRefresh &&
                        (checkout.cardCents === 0 ? (
                            <Button type="button" className="party-primary w-full" onClick={() => void pay()}>
                                {checkout.giftCardCents > 0
                                    ? `Pay ${money(checkout.giftCardCents)} with gift card`
                                    : 'Submit'}
                            </Button>
                        ) : (
                            <PaymentForm
                                key={checkout.submissionId}
                                applicationId={SQUARE_APPLICATION_ID}
                                locationId={checkout.locationId}
                                cardTokenizeResponseReceived={async (result, verification) => {
                                    if (result.status === 'OK' && result.token)
                                        await pay(result.token, verification?.token ?? '')
                                    else setError('Unable to verify your card. Please check your card details.')
                                }}
                                createVerificationDetails={() => ({
                                    amount: (checkout.cardCents / 100).toFixed(2),
                                    currencyCode: 'AUD',
                                    intent: 'CHARGE',
                                    billingContact: {
                                        givenName: payload.parentFirstName,
                                        familyName: payload.parentLastName,
                                        email: checkout.parentEmail,
                                    },
                                })}
                            >
                                <CreditCard
                                    buttonProps={{ css: { backgroundColor: '#a92c83', borderRadius: '999px' } }}
                                >
                                    Pay {money(checkout.cardCents)}
                                </CreditCard>
                            </PaymentForm>
                        ))
                    )}
                </>
            )}
        </section>
    )
}

function money(cents: number) {
    return `$${(cents / 100).toFixed(2)}`
}

export function PartyPaymentRecovery({
    bookingId,
    input,
    onCompleted,
    onReset,
}: {
    bookingId: string
    input: SubmitPartyFormV2
    onCompleted: (receiptUrl: string | null) => void
    onReset: () => void
}) {
    const trpc = useTRPC()
    const { mutateAsync, isPending } = useMutation(trpc.parties.submitPartyFormV2.mutationOptions())
    const [failed, setFailed] = useState(false)
    const [message, setMessage] = useState('Confirm your previous payment before starting another checkout.')
    const inFlight = useRef(false)
    async function resume() {
        if (inFlight.current) return
        inFlight.current = true
        try {
            const result = await mutateAsync(input)
            if (result.status === 'completed') {
                clearPartyPaymentAttempt(bookingId)
                onCompleted(result.receiptUrl)
            } else setMessage('Your payment or party details are still processing. Please check again shortly.')
        } catch (error) {
            const failure = error as { message: string; data?: { code?: string } }
            if (
                [
                    'BAD_REQUEST',
                    'PAYMENT_METHOD_INVALID',
                    'GIFT_CARD_INACTIVE',
                    'DISCOUNT_CODE_ALREADY_REDEEMED',
                ].includes(failure.data?.code ?? '')
            ) {
                clearPartyPaymentAttempt(bookingId)
                setFailed(true)
            }
            setMessage(failure.message)
        } finally {
            inFlight.current = false
        }
    }
    return (
        <section className="party-section" aria-live="polite">
            <h1 className="font-lilita text-3xl">Payment status</h1>
            <p className="my-5">{message}</p>
            {failed ? (
                <Button type="button" onClick={onReset}>
                    Return to party details
                </Button>
            ) : (
                <Button type="button" disabled={isPending} onClick={() => void resume()}>
                    {isPending ? 'Checking payment...' : 'Check payment status'}
                </Button>
            )}
        </section>
    )
}
