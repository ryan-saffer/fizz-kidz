import { useState } from 'react'
import { ApplePay, CreditCard, GooglePay, PaymentForm } from 'react-square-web-payments-sdk'

import { partyFormV2RequiresPayment } from '@fizz-kidz/core'

import { SQUARE_APPLICATION_ID } from '@integrations/square'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { cn } from '@shared/lib/tailwind'

import { usePartyFormApi, usePartyFormStore } from '../../state/party-form-store'
import { LoadingState } from '../common/loading-state'
import { PrimaryButton } from '../common/primary-button'
import { Section } from '../common/section'
import { inputClassName } from '../common/text-fields'
import { PaymentStatus } from './payment-status'

/** The review step's payment. Amounts come from the checkout the store prepared on the server. */
export function PartyPayment() {
    const form = usePartyFormApi()
    const payload = usePartyFormStore((state) => state.payload)
    const checkout = usePartyFormStore((state) => state.checkout)
    const applied = usePartyFormStore((state) => state.applied)
    const preparing = usePartyFormStore((state) => state.preparing)
    const paying = usePartyFormStore((state) => state.paying)
    const processing = usePartyFormStore((state) => state.processing)
    const needsRefresh = usePartyFormStore((state) => state.needsRefresh)
    const error = usePartyFormStore((state) => state.error)
    const { applyCodes, prepare, pay } = usePartyFormStore.getState()
    const [discountCode, setDiscountCode] = useState('')
    const [giftCardNumber, setGiftCardNumber] = useState('')

    if (processing) return <PaymentStatus />

    return (
        <Section title="Payment" aria-label="Payment">
            <fieldset disabled={preparing || paying} className="min-w-0">
                {payload && partyFormV2RequiresPayment(payload) && (
                    <div className="mb-5 grid gap-5">
                        <div>
                            <Label htmlFor="party-discount-code">Discount Code</Label>
                            <div className="mt-2 flex gap-2">
                                <Input
                                    id="party-discount-code"
                                    className={inputClassName}
                                    value={discountCode}
                                    onChange={(event) => setDiscountCode(event.target.value)}
                                />
                                <Button
                                    type="button"
                                    disabled={!discountCode.trim()}
                                    onClick={() => applyCodes({ discountCode: discountCode.trim() })}
                                >
                                    Apply discount
                                </Button>
                            </div>
                            {applied.discountCode && (
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => {
                                        applyCodes({ discountCode: '' })
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
                                    className={inputClassName}
                                    autoComplete="off"
                                    value={giftCardNumber}
                                    onChange={(event) => setGiftCardNumber(event.target.value)}
                                />
                                <Button
                                    type="button"
                                    disabled={!giftCardNumber.trim()}
                                    onClick={() => applyCodes({ giftCardNumber: giftCardNumber.trim() })}
                                >
                                    Apply gift card
                                </Button>
                            </div>
                            {applied.giftCardNumber && (
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => {
                                        applyCodes({ giftCardNumber: '' })
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
            {preparing && <LoadingState title="Updating your payment summary" />}
            {error && (
                <p role="alert" className="my-4 text-red-600">
                    {error}
                </p>
            )}
            {(!checkout || needsRefresh) && !preparing && (
                <Button type="button" onClick={() => void prepare()}>
                    Refresh payment summary
                </Button>
            )}
            {checkout && !preparing && (
                <>
                    <dl className="mt-6 grid gap-3">
                        {checkout.items.map((item, index) => (
                            <TotalRow key={`${item.label}-${index}`} label={item.label} cents={item.amountCents} />
                        ))}
                        <TotalRow
                            label="Subtotal"
                            cents={checkout.subtotalCents}
                            className="mt-1 border-t border-party-line pt-4 text-sm text-party-muted"
                        />
                        {checkout.discountCode && (
                            <TotalRow
                                label={`Discount code '${checkout.discountCode}'`}
                                cents={-checkout.discountCents}
                                className="text-sm text-party-muted"
                            />
                        )}
                        {checkout.giftCardCents > 0 && (
                            <TotalRow
                                label={`Gift card ending ${checkout.giftCardLast4}`}
                                cents={-checkout.giftCardCents}
                                className="text-sm text-party-muted"
                            />
                        )}
                        <TotalRow
                            label="To pay by card"
                            cents={checkout.cardCents}
                            className="items-baseline border-t border-party-line pt-4 text-lg font-semibold text-party-ink"
                        />
                    </dl>
                    <p className="my-5 text-sm text-muted-foreground">
                        The rest of your party payment will be made at the end of the party.
                    </p>
                    {paying ? (
                        <LoadingState
                            title="Processing your payment"
                            description="This can take a few seconds. Please keep this page open."
                        />
                    ) : (
                        !needsRefresh &&
                        (checkout.cardCents === 0 ? (
                            <PrimaryButton type="button" className="w-full" onClick={() => void pay()}>
                                {checkout.giftCardCents > 0
                                    ? `Pay ${money(checkout.giftCardCents)} with gift card`
                                    : 'Submit'}
                            </PrimaryButton>
                        ) : (
                            <PaymentForm
                                key={checkout.checkoutId}
                                applicationId={SQUARE_APPLICATION_ID}
                                locationId={checkout.locationId}
                                cardTokenizeResponseReceived={async (result, verification) => {
                                    // cards and wallets both arrive here; wallets need no buyer verification
                                    if (result.status === 'OK' && result.token)
                                        await pay(result.token, verification?.token ?? '')
                                    else
                                        usePartyFormStore.setState({
                                            error: 'Your payment was not completed. Please check your details and try again, or use another payment method.',
                                        })
                                }}
                                createVerificationDetails={() => ({
                                    amount: (checkout.cardCents / 100).toFixed(2),
                                    currencyCode: 'AUD',
                                    intent: 'CHARGE',
                                    billingContact: {
                                        givenName: form.state.values.parentFirstName,
                                        familyName: form.state.values.parentLastName,
                                        email: checkout.customerEmail,
                                    },
                                })}
                                createPaymentRequest={() => ({
                                    countryCode: 'AU',
                                    currencyCode: 'AUD',
                                    lineItems: checkout.items.map((item) => ({
                                        label: item.label,
                                        amount: dollars(item.amountCents),
                                    })),
                                    discounts: [
                                        ...(checkout.discountCode
                                            ? [
                                                  {
                                                      label: `Discount code '${checkout.discountCode}'`,
                                                      amount: dollars(checkout.discountCents),
                                                  },
                                              ]
                                            : []),
                                        ...(checkout.giftCardCents > 0
                                            ? [
                                                  {
                                                      label: `Gift card ending ${checkout.giftCardLast4}`,
                                                      amount: dollars(checkout.giftCardCents),
                                                  },
                                              ]
                                            : []),
                                    ],
                                    total: { label: 'Fizz Kidz', amount: dollars(checkout.cardCents) },
                                })}
                            >
                                <ApplePay className="mb-3" />
                                <GooglePay className="mb-3" />
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
        </Section>
    )
}

function dollars(cents: number) {
    return (cents / 100).toFixed(2)
}

function money(cents: number) {
    return `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`
}

function TotalRow({ label, cents, className }: { label: string; cents: number; className?: string }) {
    return (
        <div className={cn('flex justify-between gap-4', className)}>
            <dt>{label}</dt>
            <dd className="whitespace-nowrap">{money(cents)}</dd>
        </div>
    )
}
