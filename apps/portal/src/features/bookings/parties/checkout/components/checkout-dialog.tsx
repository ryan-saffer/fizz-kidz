import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect } from 'react'

import { getPartyBirthdayChildDisplay } from '@fizz-kidz/core'

import { ChargeStatus } from '@features/terminal-checkout/components/charge-status'
import { CheckoutSteps } from '@features/terminal-checkout/components/checkout-steps'
import { TerminalCheckoutProvider } from '@features/terminal-checkout/components/terminal-checkout-provider'
import {
    CheckoutLoading,
    CheckoutProblem,
    TerminalCheckoutSheet,
} from '@features/terminal-checkout/components/terminal-checkout-sheet'
import { useTRPC } from '@integrations/trpc'
import { useWhileClosing } from '@shared/hooks/use-while-closing'

import { getEstimateLines, useCheckoutStore } from '../state/checkout-store'
import { FoodStep } from './steps/food-step'
import { PartyStep } from './steps/party-step'

/** The full screen checkout for collecting a party's payment. Mounted once on the bookings page. */
export function CheckoutDialog() {
    const open = useCheckoutStore((state) => state.subject !== null)
    const booking = useWhileClosing(useCheckoutStore((state) => state.subject))
    const close = useCheckoutStore((state) => state.close)
    const charging = useCheckoutStore((state) => state.stage === 'charging')

    // the store outlives the page; a charge still on the terminal resumes when the checkout is opened again
    useEffect(() => () => useCheckoutStore.getState().close(), [])

    return (
        <TerminalCheckoutSheet
            open={open}
            onClose={close}
            charging={charging}
            title="Collect payment"
            description={
                booking &&
                `${getPartyBirthdayChildDisplay(booking)} party · ${booking.parentFirstName} ${booking.parentLastName}`
            }
        >
            {booking && (
                <TerminalCheckoutProvider store={useCheckoutStore} studio={booking.location}>
                    <CheckoutBody key={booking.id} bookingId={booking.id} />
                </TerminalCheckoutProvider>
            )}
        </TerminalCheckoutSheet>
    )
}

function CheckoutBody({ bookingId }: { bookingId: string }) {
    const trpc = useTRPC()
    // loaded fresh each time the checkout opens, then kept as is so a paid party doesn't swap to "already paid"
    const config = useQuery(
        trpc.parties.getPartyCheckout.queryOptions(
            { bookingId },
            { staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }
        )
    )
    const { mutateAsync: prepare } = useMutation(trpc.parties.preparePartyCheckout.mutationOptions())
    const { mutateAsync: start } = useMutation(trpc.parties.startPartyCheckout.mutationOptions())
    const { mutateAsync: status } = useMutation(trpc.parties.getPartyCheckoutStatus.mutationOptions())
    const { mutateAsync: cancel } = useMutation(trpc.parties.cancelPartyCheckout.mutationOptions())
    const ready = useCheckoutStore((state) => state.config !== null && state.config === config.data)
    const stage = useCheckoutStore((state) => state.stage)
    const answers = useCheckoutStore((state) => state.answers)

    useLayoutEffect(() => {
        if (config.data && config.data.blocked === null)
            useCheckoutStore.getState().init({
                config: config.data,
                answers: config.data.prefill,
                server: {
                    prepare: (answers) => prepare({ bookingId, ...answers }),
                    start: (input) => start({ bookingId, ...input }),
                    status: (charge) => status({ bookingId, ...charge }),
                    cancel: (charge) => cancel({ bookingId, ...charge }),
                },
            })
    }, [config.data, bookingId, prepare, start, status, cancel])

    if (config.isPending) return <CheckoutLoading />
    if (config.isError)
        return <CheckoutProblem>Unable to load the party&apos;s prices from Square. Please try again.</CheckoutProblem>
    if (config.data.blocked !== null) return <CheckoutProblem>{config.data.blocked}</CheckoutProblem>
    if (!ready) return null
    if (stage !== 'editing')
        return (
            <ChargeStatus
                paidMessage={
                    <>
                        A receipt has been emailed to <strong>{config.data.customerEmail}</strong>.
                    </>
                }
            />
        )
    return (
        <CheckoutSteps
            estimate={getEstimateLines(config.data, answers)}
            renderStep={(step) => (step === 'party' ? <PartyStep /> : <FoodStep />)}
        />
    )
}
