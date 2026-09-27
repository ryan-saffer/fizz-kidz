import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect, useLayoutEffect } from 'react'

import { getPartyBirthdayChildDisplay, type Studio } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { Sheet, SheetContent } from '@shared/components/ui/sheet'

import { FullScreenHeader } from '../../components/full-screen-header'
import { useWhileClosing } from '../../hooks/use-while-closing'
import { useCheckoutStore } from '../state/checkout-store'
import { ChargeStatus } from './charge-status'
import { CheckoutSteps } from './checkout-steps'

/** The full screen checkout for collecting a party's payment. Mounted once on the bookings page. */
export function CheckoutDialog() {
    const open = useCheckoutStore((state) => state.booking !== null)
    const booking = useWhileClosing(useCheckoutStore((state) => state.booking))
    const close = useCheckoutStore((state) => state.close)
    const stage = useCheckoutStore((state) => state.stage)

    // the store outlives the page; a charge still on the terminal resumes when the checkout is opened again
    useEffect(() => () => useCheckoutStore.getState().close(), [])

    return (
        <Sheet
            open={open}
            // a charge on the terminal is cancelled or finished first, so it isn't left behind
            onOpenChange={(open) => !open && stage !== 'charging' && close()}
        >
            <SheetContent
                side="bottom"
                className="twp top-0 flex h-[100dvh] flex-col gap-0 border-0 bg-slate-100 p-0 focus:outline-none"
                onOpenAutoFocus={(e) => e.preventDefault()}
                hideCloseBtn
            >
                {booking && (
                    <>
                        <FullScreenHeader
                            className="max-w-5xl"
                            title="Collect payment"
                            description={`${getPartyBirthdayChildDisplay(booking)} party · ${booking.parentFirstName} ${booking.parentLastName}`}
                            // a charge on the terminal is cancelled or finished first
                            closeDisabled={stage === 'charging'}
                        />
                        <CheckoutBody key={booking.id} bookingId={booking.id} studio={booking.location} />
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

function CheckoutBody({ bookingId, studio }: { bookingId: string; studio: Studio }) {
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

    useLayoutEffect(() => {
        if (config.data && config.data.blocked === null)
            useCheckoutStore.getState().init({
                config: config.data,
                server: { prepare, start, status, cancel },
            })
    }, [config.data, prepare, start, status, cancel])

    // the studio's terminal is the one paired with the portal at its Square location
    const terminals = useQuery(trpc.parties.listPartyTerminals.queryOptions({ studio }))
    useEffect(() => {
        if (ready && terminals.data) useCheckoutStore.getState().setTerminals(terminals.data)
    }, [ready, terminals.data])

    if (config.isPending)
        return (
            <Centered>
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </Centered>
        )
    if (config.isError) return <Problem>Unable to load the party's prices from Square. Please try again.</Problem>
    if (config.data.blocked !== null) return <Problem>{config.data.blocked}</Problem>
    if (!ready) return null
    return stage === 'editing' ? <CheckoutSteps /> : <ChargeStatus />
}

function Centered({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-1 items-center justify-center p-6">{children}</div>
}

function Problem({ children }: { children: React.ReactNode }) {
    return (
        <Centered>
            <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-sm">
                <AlertCircle className="h-10 w-10 text-rose-500" />
                <p className="text-slate-700">{children}</p>
            </div>
        </Centered>
    )
}
