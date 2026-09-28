import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect } from 'react'

import { capitalise, type Studio } from '@fizz-kidz/core'

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

import { getEstimateLines, usePosStore } from '../state/pos-store'
import { ProductsStep } from './products-step'

/** The full screen checkout for selling products at a studio. */
export function PosDialog() {
    const open = usePosStore((state) => state.subject !== null)
    const studio = useWhileClosing(usePosStore((state) => state.subject))
    const close = usePosStore((state) => state.close)
    const charging = usePosStore((state) => state.stage === 'charging')

    // the store outlives the page; a charge still on the terminal resumes when a sale is opened again
    useEffect(() => () => usePosStore.getState().close(), [])

    return (
        <TerminalCheckoutSheet
            open={open}
            onClose={close}
            charging={charging}
            title="Sell products"
            description={studio && `${capitalise(studio)} studio`}
        >
            {studio && (
                <TerminalCheckoutProvider store={usePosStore} studio={studio}>
                    <SaleBody key={studio} studio={studio} />
                </TerminalCheckoutProvider>
            )}
        </TerminalCheckoutSheet>
    )
}

function SaleBody({ studio }: { studio: Studio }) {
    const trpc = useTRPC()
    // loaded fresh for each sale, then kept as is while it's charged
    const config = useQuery(
        trpc.pos.getPos.queryOptions(
            { studio },
            { staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }
        )
    )
    const { mutateAsync: prepare } = useMutation(trpc.pos.preparePos.mutationOptions())
    const { mutateAsync: start } = useMutation(trpc.pos.startPos.mutationOptions())
    const { mutateAsync: status } = useMutation(trpc.pos.getPosStatus.mutationOptions())
    const { mutateAsync: cancel } = useMutation(trpc.pos.cancelPos.mutationOptions())
    const ready = usePosStore((state) => state.config !== null && state.config === config.data)
    const stage = usePosStore((state) => state.stage)
    const hasItems = usePosStore((state) => state.answers.items.length > 0)
    const answers = usePosStore((state) => state.answers)

    useLayoutEffect(() => {
        if (config.data && config.data.blocked === null)
            usePosStore.getState().init({
                config: config.data,
                server: {
                    prepare: (answers) => prepare({ studio, ...answers }),
                    start: (input) => start({ studio, ...input }),
                    status: (charge) => status({ studio, ...charge }),
                    cancel: (charge) => cancel({ studio, ...charge }),
                },
            })
    }, [config.data, studio, prepare, start, status, cancel])

    if (config.isPending) return <CheckoutLoading />
    if (config.isError)
        return <CheckoutProblem>Unable to load the products from Square. Please try again.</CheckoutProblem>
    if (config.data.blocked !== null) return <CheckoutProblem>{config.data.blocked}</CheckoutProblem>
    if (!ready) return null
    if (stage !== 'editing')
        return (
            <ChargeStatus
                paidMessage="Square sends the customer a receipt if they asked for one on the terminal."
                startOverLabel="New sale"
            />
        )
    return (
        <CheckoutSteps
            estimate={getEstimateLines(config.data, answers)}
            canContinue={hasItems}
            renderStep={() => <ProductsStep />}
        />
    )
}
