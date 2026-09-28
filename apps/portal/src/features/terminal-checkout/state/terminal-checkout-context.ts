import { createContext, useContext } from 'react'

import type { Studio } from '@fizz-kidz/core'

import type { CheckoutAdjustments, TerminalCheckoutStore } from './terminal-checkout-store'
import type { StoreApi, UseBoundStore } from 'zustand'

/** Any terminal checkout's store, as the shared components see it: without knowing what's being charged. */
export type AnyTerminalCheckoutStore = UseBoundStore<
    StoreApi<TerminalCheckoutStore<unknown, unknown, CheckoutAdjustments>>
>

/** The checkout's store and the studio whose terminal it charges. See `TerminalCheckoutProvider`. */
export const TerminalCheckoutContext = createContext<{ store: AnyTerminalCheckoutStore; studio: Studio } | null>(null)

function useContextValue() {
    const value = useContext(TerminalCheckoutContext)
    if (!value) throw new Error('Terminal checkout components need a TerminalCheckoutProvider')
    return value
}

/** Reads the checkout's store from a shared component. */
export function useTerminalCheckout<T>(
    selector: (state: TerminalCheckoutStore<unknown, unknown, CheckoutAdjustments>) => T
) {
    // named as a hook, so the React Compiler doesn't cache it as a plain call and skip its hooks
    const { store: useStore } = useContextValue()
    return useStore(selector)
}

export const useCheckoutStudio = () => useContextValue().studio
