import { styled } from '@mui/material/styles'
import { useMutation } from '@tanstack/react-query'
import { Button } from 'antd'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { DateTime } from 'luxon'
import React, { useEffect, useRef } from 'react'
import { ApplePay, CreditCard, GooglePay, PaymentForm } from 'react-square-web-payments-sdk'
import { toast } from 'sonner'

import { getSquareLocationId } from '@fizz-kidz/core'
import type { DiscountCode } from '@fizz-kidz/core'

import { SQUARE_APPLICATION_ID } from '@integrations/square'
import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'

import { useCart } from '../../state/cart-store'
import BookingSummary from './booking-summary'
import DiscountInput from './discount-input'
import { GiftCardInput } from './gift-card-input'

import type { Form } from '../../pages/customer-booking-page'

type Props = {
    form: Form
    handleBookingSuccess: () => void
}

const PREFIX = 'Payment'

const classes = {
    primaryButton: `${PREFIX}-primaryButton`,
}

const Root = styled('div')({
    [`& .${classes.primaryButton}`]: {
        background: 'linear-gradient(45deg, #f86ca7ff, #f4d444ff)',
        borderColor: 'white',
    },
})

const Step3: React.FC<Props> = ({ form, handleBookingSuccess }) => {
    const trpc = useTRPC()
    // MARK: variables
    const selectedClasses = useCart((store) => store.selectedClasses)
    const selectedStudio = useCart((store) => store.selectedStudio)
    const totalShownToCustomer = useCart((store) => store.totalShownToCustomer)
    const subtotal = useCart((store) => store.subtotal)
    const discount = useCart((store) => store.discount)
    const giftCard = useCart((store) => store.giftCard)
    const calculateTotal = useCart((store) => store.calculateTotal)

    const squareLocationId = getSquareLocationId(selectedStudio!)

    const idempotencyKey = useRef(crypto.randomUUID())
    const conversionEventPushed = useRef(false)
    const walletKey = `${discount?.code}-${discount?.discountAmount}-${discount?.discountType}-${giftCard?.id}` // force rerender the square checkout component when disconut code changes

    // MARK: hooks
    const {
        mutateAsync: book,
        isPending,
        isSuccess,
        isError,
        error,
        data: bookingResult,
    } = useMutation(trpc.holidayPrograms.book.mutationOptions())

    useEffect(() => {
        calculateTotal(form.children.length)
    }, [calculateTotal, form.children.length, selectedClasses])

    useEffect(() => {
        if (isSuccess) {
            if (bookingResult && !conversionEventPushed.current) {
                conversionEventPushed.current = true
                window.dataLayer = window.dataLayer || []
                window.dataLayer.push({
                    event: 'holiday_program_booking',
                    value: bookingResult.value,
                    currency: bookingResult.currency,
                    transaction_id: bookingResult.transactionId,
                    studio: bookingResult.studio,
                })
            }

            handleBookingSuccess()
        }
    }, [bookingResult, isSuccess, handleBookingSuccess])

    // MARK: functions
    function handleBooking({ token, buyerVerificationToken }: { token?: string; buyerVerificationToken?: string }) {
        calculateTotal(form.children.length)
        const currentCart = useCart.getState()

        return book({
            idempotencyKey: idempotencyKey.current,
            parentFirstName: form.parentFirstName,
            parentLastName: form.parentLastName,
            parentEmail: form.parentEmail,
            parentPhone: form.phone,
            emergencyContactName: form.emergencyContact,
            emergencyContactPhone: form.emergencyPhone,
            joinMailingList: form.joinMailingList,
            numberOfKids: form.children.length,
            payment: {
                token: token || '',
                buyerVerificationToken: buyerVerificationToken || '',
                giftCardId: currentCart.giftCard?.id || '',
                amount: Math.round(currentCart.total * 100), // cents
                locationId: squareLocationId,
                lineItems: Object.values(currentCart.selectedClasses).flatMap((klass) =>
                    form.children.map((child) => ({
                        name: `${child.childName} - ${formatClassTime(klass.time)}`,
                        amount: Math.round(parseInt(klass.price) * 100), // cents
                        quantity: '1',
                        classId: klass.id,
                        lineItemIdentifier: crypto.randomUUID(),
                        appointmentTypeId: klass.appointmentTypeID,
                        time: klass.time,
                        calendarId: klass.calendarID,
                        childName: child.childName,
                        childDob: child.childAge.toISOString(),
                        childAllergies: child.allergies || '',
                        childIsAnaphylactic: child.isAnaphylactic === 'yes',
                        childAnaphylaxisPlan: child.anaphylaxisPlan?.storagePath || '',
                        childRequiresAsthmaActionPlan: child.requiresAsthmaActionPlan === 'yes',
                        childAsthmaActionPlan: child.asthmaActionPlan?.storagePath || '',
                        childAdditionalInfo: child.additionalInfo || '',
                        isAllDayClass: currentCart.sameDayClasses.includes(klass.id),
                        title: klass.title,
                        creations: klass.creations,
                    }))
                ),
                discount: currentCart.discount
                    ? {
                          ...currentCart.discount,
                          discountAmount:
                              currentCart.discount.discountType === 'percentage'
                                  ? currentCart.discount.discountAmount
                                  : currentCart.discount.discountAmount * 100, // price discounts must be in cents
                          description: discountDescription(currentCart.discount),
                      }
                    : null,
            },
        })
    }

    function formatClassTime(date: string) {
        return DateTime.fromISO(date, { zone: 'Australia/Melbourne' }).toFormat('EEEE MMMM d, h:mm a')
    }

    function discountDescription(discount: DiscountCode) {
        if (discount.discountType === 'percentage') {
            return `Discount code '${discount.code}' - ${discount.discountAmount}% off`
        } else {
            return `Discount code '${discount.code}' - $${discount.discountAmount} off`
        }
    }

    function renderError() {
        if (isError) {
            let errorMessage =
                'There was an error booking in your sessions. Please try again later or contact us at bookings@fizzkidz.com.au'
            let errorTitle = 'Something went wrong'

            if (error.data?.code === 'CLASS_FULL') {
                errorMessage =
                    "One or more of your selected sessions does not have enough spots available. Please return to the 'Select Sessions' step and review your selected sessions."
                errorTitle = 'One or more sessions are full'
            }

            if (error.data?.code === 'PAYMENT_METHOD_INVALID') {
                errorTitle = 'Payment Failed'
                errorMessage =
                    'Unfortunately we were unable to process your payment. Please check your payment method and try again.'
            }

            if (error.data?.code === 'GIFT_CARD_INACTIVE') {
                errorTitle = 'Gift Card Inactive'
                errorMessage =
                    'The provided gift card is not active and cannot be used. Please check your gift card and try again.'
            }

            return (
                <Alert variant="destructive" className="twp my-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-semibold">{errorTitle}</AlertTitle>
                    <AlertDescription className="font-medium">{errorMessage}</AlertDescription>
                </Alert>
            )
        }

        return null
    }

    // MARK: rendering
    if (isSuccess) {
        return (
            <>
                <Alert variant="success" className="twp">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle className="font-semibold">Booked!</AlertTitle>
                    <AlertDescription className="font-medium">
                        Your sessions have been booked, and you should have a booking confirmation email.
                        <br />
                        <br />
                        We can't wait to see you soon!
                    </AlertDescription>
                </Alert>
            </>
        )
    }

    if (isPending) {
        return (
            <div className="twp">
                <p className="mt-4 text-center">Processing payment...</p>
                <p className="mt-2 text-center">Please do not close or refresh this window.</p>
                <Loader className="my-4" />
            </div>
        )
    }

    return (
        <>
            <BookingSummary form={form} numberOfKids={form.children.length} />
            <DiscountInput numberOfKids={form.children.length} parentEmail={form.parentEmail} />
            <GiftCardInput numberOfKids={form.children.length} />
            <Root>
                <PaymentForm
                    key={walletKey}
                    applicationId={SQUARE_APPLICATION_ID}
                    locationId={squareLocationId}
                    cardTokenizeResponseReceived={async (result, buyerVerification) => {
                        if (result.status === 'OK' && result.token) {
                            await handleBooking({
                                token: result.token,
                                buyerVerificationToken: buyerVerification?.token,
                            })
                        } else {
                            toast.error('There was an error processing your payment')
                        }
                    }}
                    createVerificationDetails={() => ({
                        amount: totalShownToCustomer.toFixed(2),
                        billingContact: {
                            givenName: form.parentFirstName,
                            familyName: form.parentLastName,
                            email: form.parentEmail,
                            phone: form.phone,
                        },
                        currencyCode: 'AUD',
                        intent: 'CHARGE',
                    })}
                    createPaymentRequest={() => ({
                        countryCode: 'AU',
                        currencyCode: 'AUD',
                        lineItems: Object.values(selectedClasses).flatMap((klass) =>
                            form.children.map((child) => ({
                                amount: klass.price,
                                label: `${child.childName} - ${formatClassTime(klass.time)}`,
                            }))
                        ),
                        discounts: discount
                            ? discount.discountType === 'percentage'
                                ? [
                                      {
                                          label: 'Discount',
                                          amount: (subtotal * (discount.discountAmount / 100)).toFixed(2),
                                      },
                                  ]
                                : [{ label: 'Discount', amount: discount.discountAmount.toFixed(2) }]
                            : undefined,
                        total: {
                            label: 'Total',
                            amount: totalShownToCustomer.toFixed(2),
                        },
                    })}
                >
                    {isError ? (
                        renderError()
                    ) : totalShownToCustomer === 0 ? (
                        <Button
                            block
                            type="primary"
                            size="large"
                            className="my-4"
                            disabled={isPending}
                            onClick={() => handleBooking({ token: '', buyerVerificationToken: '' })}
                        >
                            Book
                        </Button>
                    ) : (
                        <>
                            <ApplePay style={{ marginTop: 32, marginBottom: 8 }} />
                            <GooglePay style={{ marginTop: 32, marginBottom: 8 }} />
                            <CreditCard
                                buttonProps={{
                                    css: {
                                        backgroundColor: '#AC4390',
                                        '&:hover': { backgroundColor: '#B4589C' },
                                        marginBottom: 16,
                                    },
                                }}
                            />
                        </>
                    )}
                </PaymentForm>
            </Root>
        </>
    )
}

export default Step3
