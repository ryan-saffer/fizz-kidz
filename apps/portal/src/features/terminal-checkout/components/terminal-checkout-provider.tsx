import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { Studio } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'

import { TerminalCheckoutContext, type AnyTerminalCheckoutStore } from '../state/terminal-checkout-context'

import type { CheckoutAdjustments, TerminalCheckoutStore } from '../state/terminal-checkout-store'
import type { ReactNode } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'

/**
 * Gives the shared checkout components the checkout's store, and the studio whose terminal it charges. The studio's
 * terminals load as soon as the checkout opens, so a charge resumed after a reload knows which terminal has it.
 */
export function TerminalCheckoutProvider<Subject, Config, Answers extends CheckoutAdjustments>({
    store,
    studio,
    children,
}: {
    store: UseBoundStore<StoreApi<TerminalCheckoutStore<Subject, Config, Answers>>>
    studio: Studio
    children: ReactNode
}) {
    const trpc = useTRPC()
    const terminals = useQuery(trpc.payments.listTerminals.queryOptions({ studio }))
    // the studio's terminal is the one paired with the portal at its Square location
    useEffect(() => {
        if (terminals.data) store.getState().setTerminals(terminals.data)
    }, [terminals.data, store])

    return (
        <TerminalCheckoutContext.Provider value={{ store: store as unknown as AnyTerminalCheckoutStore, studio }}>
            {children}
        </TerminalCheckoutContext.Provider>
    )
}
