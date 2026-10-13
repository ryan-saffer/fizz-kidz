import { useMutation } from '@tanstack/react-query'
import { AlertCircle, ChevronLeft, CreditCard as CreditCardIcon, PartyPopper, TicketCheck, XIcon } from 'lucide-react'
import { DateTime } from 'luxon'
import { useEffect, useRef } from 'react'
import { useWatch } from 'react-hook-form'
import { ApplePay, CreditCard, GooglePay, PaymentForm } from 'react-square-web-payments-sdk'
import { toast } from 'sonner'

import { getSquareLocationId } from '@fizz-kidz/core'

import { SQUARE_APPLICATION_ID } from '@integrations/square'
import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'

import { FULL_TERM_DISCOUNT_PERCENTAGE, useCart } from '../../state/cart-store'
import { useBookingForm } from '../../state/form-schema'
import { useFormStage } from '../../state/form-stage-store'
import { DiscountInput } from './discount-input'
import { GiftCardInput } from './gift-card-input'

export function Payment() {
    const trpc = useTRPC()
    const form = useBookingForm()
    const formStage = useFormStage((store) => store.formStage)
    const nextStage = useFormStage((store) => store.nextStage)
    const previousStage = useFormStage((store) => store.previousStage)
    const {
        selectedClasses,
        fullTermClassIds,
        subtotal,
        fullTermDiscount,
        discountCode,
        discountCodeAmount,
        totalCents,
        totalShownToCustomer,
        totalShownToCustomerCents,
        giftCard,
        clearGiftCard,
        clearDiscountCode,
    } = useCart()
    const children = useWatch({ control: form.control, name: 'children' })
    const studio = useWatch({ control: form.control, name: 'studio' })
    const squareLocationId = studio ? getSquareLocationId(studio) : ''
    const walletKey = `${fullTermDiscount}-${discountCode?.code}-${discountCodeAmount}-${giftCard?.id}-${totalShownToCustomerCents}`
    const idempotencyKey = useRef(crypto.randomUUID())
    const { mutateAsync, isPending, isError, error, reset } = useMutation(
        trpc.preschoolProgramV2.book.mutationOptions()
    )

    useEffect(() => {
        if (formStage !== 'payment') reset()
    }, [formStage, reset])

    async function book(token: string, buyerVerificationToken: string) {
        if (!studio) return

        if (isError) {
            idempotencyKey.current = crypto.randomUUID()
        }

        await mutateAsync({
            idempotencyKey: idempotencyKey.current,
            parentFirstName: form.getValues().parentFirstName,
            parentLastName: form.getValues().parentLastName,
            parentPhone: form.getValues().parentPhone,
            parentEmail: form.getValues().parentEmailAddress,
            emergencyContactName: form.getValues().emergencyContactName,
            emergencyContactPhone: form.getValues().emergencyContactNumber,
            emergencyContactRelation: form.getValues().emergencyContactRelation,
            children: form.getValues().children.map((child) => ({
                firstName: child.firstName,
                lastName: child.lastName,
                dob: child.dob.toISOString(),
                hasAllergies: child.hasAllergies === true,
                allergies: child.allergies || '',
                isAnaphylactic: child.isAnaphylactic === true,
                anaphylaxisPlan: child.anaphylaxisPlan,
                additionalInfo: child.additionalInfo || '',
            })),
            joinMailingList: form.getValues().joinMailingList,
            payment: {
                token,
                buyerVerificationToken,
                giftCardId: giftCard?.id || '',
                locationId: squareLocationId,
                amount: totalCents,
                lineItems: buildLineItems(),
                discount: discountCode,
            },
        })
        nextStage()
    }

    function buildLineItems() {
        return Object.values(selectedClasses).flatMap((klass) => {
            return children.map((child) => ({
                name: `${child.firstName} - Messy Play - ${formatClassDateTime(klass.time)}`,
                amount: Math.round(Number.parseFloat(klass.price) * 100),
                classId: klass.id,
                lineItemIdentifier: crypto.randomUUID(),
                appointmentTypeID: klass.appointmentTypeID,
                time: klass.time.toISOString(),
                duration: klass.duration,
                calendarID: klass.calendarID,
                childFirstName: child.firstName,
                childLastName: child.lastName,
                childDob: child.dob.toISOString(),
                childAllergies: child.allergies || '',
                childIsAnaphylactic: child.isAnaphylactic === true,
                childAnaphylaxisPlanStoragePath: child.anaphylaxisPlan?.storagePath || '',
                childAdditionalInfo: child.additionalInfo || '',
                isFullTermDiscount: !!fullTermClassIds[klass.id],
            }))
        })
    }

    function renderError() {
        if (!isError) return null

        let errorTitle = 'Something went wrong'
        let errorMessage =
            'There was an error booking your Messy Play sessions. Please try again later or contact us at bookings@fizzkidz.com.au'

        if (error.data?.code === 'CLASS_FULL') {
            errorTitle = 'One or more sessions are full'
            errorMessage =
                "One or more of your selected sessions does not have enough spots available. Please return to the 'Select Sessions' screen and review your selected sessions."
        }

        if (error.data?.code === 'PAYMENT_METHOD_INVALID') {
            errorTitle = 'Payment failed'
            errorMessage = 'Unfortunately we were unable to process your payment. Please check your payment method.'
        }

        if (error.data?.code === 'GIFT_CARD_INACTIVE') {
            errorTitle = 'Gift card invalid'
            errorMessage = 'This gift card is not active and cannot be used.'
        }

        return (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-semibold">{errorTitle}</AlertTitle>
                <AlertDescription className="font-medium">{errorMessage}</AlertDescription>
            </Alert>
        )
    }

    if (formStage !== 'payment') return null

    if (isPending) {
        return (
            <>
                <p className="mt-4 text-center">Processing payment...</p>
                <p className="mt-2 text-center">Please do not close or refresh this window.</p>
                <Loader className="mt-4" />
            </>
        )
    }

    return (
        <>
            <Button variant="outline" size="sm" type="button" onClick={previousStage} className="mb-4 self-start">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to details
            </Button>
            <p className="my-2 text-center text-xl font-bold">Booking Summary</p>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead>Child</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Object.values(selectedClasses)
                        .sort((a, b) => a.time.getTime() - b.time.getTime())
                        .map((klass) =>
                            children.map((child, idx) => (
                                <TableRow key={`${klass.id}-${idx}`}>
                                    <TableCell>
                                        <span className="font-bold">{formatClassDateTime(klass.time)}</span>
                                        {fullTermClassIds[klass.id] ? (
                                            <Badge className="ml-2 bg-green-600 hover:bg-green-600">
                                                {FULL_TERM_DISCOUNT_PERCENTAGE}% off
                                            </Badge>
                                        ) : null}
                                    </TableCell>
                                    <TableCell>{child.firstName}</TableCell>
                                    <TableCell className="text-right">
                                        ${Number.parseFloat(klass.price).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                </TableBody>
                <TableFooter>
                    {(fullTermDiscount > 0 || discountCode || giftCard) && (
                        <TableRow>
                            <TableCell colSpan={2} className="py-2 font-light italic">
                                Subtotal
                            </TableCell>
                            <TableCell className="py-2 text-right font-light italic">${subtotal.toFixed(2)}</TableCell>
                        </TableRow>
                    )}
                    {fullTermDiscount > 0 ? (
                        <TableRow className="bg-green-100 hover:bg-green-100/80">
                            <TableCell colSpan={2} className="py-2 font-light italic text-green-800">
                                <div className="flex items-center">
                                    <PartyPopper className="mr-2 h-5 w-5" />
                                    Full term discount
                                </div>
                            </TableCell>
                            <TableCell className="py-2 text-right font-light italic text-green-800">
                                -${fullTermDiscount.toFixed(2)}
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {fullTermDiscount > 0 && discountCode ? (
                        <TableRow>
                            <TableCell colSpan={2} className="py-2 font-light italic text-muted-foreground">
                                Discounted subtotal
                            </TableCell>
                            <TableCell className="py-2 text-right font-light italic text-muted-foreground">
                                ${(subtotal - fullTermDiscount).toFixed(2)}
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {discountCode ? (
                        <TableRow className="bg-amber-100 hover:bg-amber-100/80">
                            <TableCell colSpan={2} className="py-2 font-light italic text-amber-900">
                                <div className="flex items-center">
                                    <TicketCheck className="mr-2 h-5 w-5" />
                                    {formatDiscountCodeLabel(discountCode)}
                                    <Button
                                        className="ml-2 min-h-0 border border-transparent p-1 hover:border-amber-900 hover:bg-amber-100/80"
                                        variant="ghost"
                                        onClick={clearDiscountCode}
                                        type="button"
                                    >
                                        <XIcon className="size-4" />
                                    </Button>
                                </div>
                            </TableCell>
                            <TableCell className="py-2 text-right font-light italic text-amber-900">
                                -${discountCodeAmount.toFixed(2)}
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {giftCard ? (
                        <TableRow className="bg-blue-100 hover:bg-blue-100/80">
                            <TableCell colSpan={2} className="py-2 font-light italic text-blue-800">
                                <div className="flex items-center">
                                    <CreditCardIcon className="mr-2 h-5 w-5" />
                                    Gift Card (${(giftCard.balanceRemainingCents / 100).toFixed(2)} remaining)
                                    <Button
                                        className="ml-2 min-h-0 border border-transparent p-1 hover:border-blue-800 hover:bg-blue-100/80"
                                        variant="ghost"
                                        onClick={clearGiftCard}
                                        type="button"
                                    >
                                        <XIcon className="size-4" />
                                    </Button>
                                </div>
                            </TableCell>
                            <TableCell className="py-2 text-right font-light italic text-blue-800">
                                -${(giftCard.balanceAppliedCents / 100).toFixed(2)}
                            </TableCell>
                        </TableRow>
                    ) : null}
                    <TableRow className="border-t">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="pt-2 text-right">${totalShownToCustomer.toFixed(2)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            <DiscountInput />
            <GiftCardInput />
            <PaymentForm
                key={walletKey}
                applicationId={SQUARE_APPLICATION_ID}
                locationId={squareLocationId}
                cardTokenizeResponseReceived={async (result, buyerVerification) => {
                    if (result.status === 'OK' && result.token && !isPending) {
                        await book(result.token, buyerVerification?.token || '')
                    } else {
                        toast.error('There was an error processing your payment')
                    }
                }}
                createVerificationDetails={() => ({
                    amount: totalShownToCustomer.toFixed(2),
                    billingContact: {
                        givenName: form.getValues().parentFirstName,
                        familyName: form.getValues().parentLastName,
                        email: form.getValues().parentEmailAddress,
                        phone: form.getValues().parentPhone,
                    },
                    currencyCode: 'AUD',
                    intent: 'CHARGE',
                })}
                createPaymentRequest={() => ({
                    countryCode: 'AU',
                    currencyCode: 'AUD',
                    lineItems: Object.values(selectedClasses).flatMap((klass) =>
                        children.map((child) => ({
                            amount: klass.price,
                            label: `${child.firstName} - Messy Play - ${formatClassDateTime(klass.time)}`,
                        }))
                    ),
                    // Apple/Google Pay sheets only expose "discounts" for reductions before the wallet charge.
                    // Gift cards are still processed server-side as payments; this is display-only for the wallet sheet.
                    discounts: [
                        ...(fullTermDiscount > 0
                            ? [{ label: 'Full term discount', amount: fullTermDiscount.toFixed(2) }]
                            : []),
                        ...(discountCode
                            ? [{ label: formatDiscountCodeLabel(discountCode), amount: discountCodeAmount.toFixed(2) }]
                            : []),
                        ...(giftCard
                            ? [
                                  {
                                      label: 'Gift card payment',
                                      amount: (giftCard.balanceAppliedCents / 100).toFixed(2),
                                  },
                              ]
                            : []),
                    ],
                    total: {
                        amount: totalShownToCustomer.toFixed(2),
                        label: 'Total',
                    },
                })}
            >
                {isError ? (
                    renderError()
                ) : totalShownToCustomerCents === 0 ? (
                    <Button className="mt-4 w-full" onClick={() => book('', '')} type="button">
                        Book
                    </Button>
                ) : (
                    <div className="mt-8">
                        <ApplePay className="mb-4" />
                        <GooglePay className="mb-4" />
                        <CreditCard
                            buttonProps={{
                                css: { backgroundColor: '#AC4390', '&:hover': { backgroundColor: '#B4589C' } },
                            }}
                        />
                    </div>
                )}
            </PaymentForm>
        </>
    )
}

/** Formats a selected session date and time for checkout line items. */
function formatClassDateTime(date: Date) {
    return DateTime.fromJSDate(date, { zone: 'Australia/Melbourne' }).toFormat('cccc d LLLL, h:mm a')
}

/** Describes a percentage or fixed discount code in customer-facing checkout text. */
function formatDiscountCodeLabel(discountCode: {
    description: string
    discountType: 'percentage' | 'price'
    discountAmount: number
}) {
    if (discountCode.discountType === 'percentage') {
        return `${discountCode.description}, ${discountCode.discountAmount}% off`
    }

    return `${discountCode.description}, $${discountCode.discountAmount.toFixed(2)} off`
}
