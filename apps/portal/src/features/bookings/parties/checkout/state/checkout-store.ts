import { create } from 'zustand'

import type {
    FirestoreBooking,
    PartyCheckoutStatus,
    PartyCheckoutSummary,
    PartyFormV2Addition,
    PartyTerminalCheckout,
    PreparePartyCheckout,
    StartPartyCheckout,
    WithId,
} from '@fizz-kidz/core'

import type { AppRouter } from '@server/app/trpc/app.trpc'

import { clearCharge, readCharge, saveCharge } from './checkout-storage'

import type { inferRouterOutputs } from '@trpc/server'

type PartyCheckoutOutput = inferRouterOutputs<AppRouter>['parties']['getPartyCheckout']

/** What a booking can be charged: Square's party prices and food additions, and the prefilled answers. */
export type CheckoutConfig = Extract<PartyCheckoutOutput, { blocked: null }>

/** The server calls the store makes. `CheckoutDialog` registers them from React Query mutations. */
export type CheckoutServer = {
    prepare: (input: PreparePartyCheckout) => Promise<PartyCheckoutSummary>
    start: (input: StartPartyCheckout) => Promise<PartyCheckoutStatus>
    status: (input: PartyTerminalCheckout) => Promise<PartyCheckoutStatus>
    cancel: (input: PartyTerminalCheckout) => Promise<unknown>
}

export type CheckoutStep = 'party' | 'food' | 'review'
export const CHECKOUT_STEPS: { key: CheckoutStep; label: string }[] = [
    { key: 'party', label: 'Party' },
    { key: 'food', label: 'Food' },
    { key: 'review', label: 'Review & charge' },
]

export type CheckoutAnswers = Omit<PreparePartyCheckout, 'bookingId'>

/** A Square Terminal paired with the portal at the studio. */
export type Terminal = { deviceId: string; name: string }

/** A charge sent to the terminal: the Square order and the terminal checkout paying it. */
type Charge = { checkoutId: string; terminalCheckoutId: string }

const POLL_INTERVAL_MS = 2000
/** Server errors in a row before giving up on checking a charge. Dropped connections keep retrying. */
const MAX_STATUS_ERRORS = 5

type State = {
    booking: WithId<FirestoreBooking> | null
    config: CheckoutConfig | null
    server: CheckoutServer | null
    /** The terminals paired at the booking's studio, once loaded. */
    terminals: Terminal[] | null
    /** The terminal to charge: the studio's own, or the one picked when there's more than one (the sandbox). */
    terminal: Terminal | null
    step: CheckoutStep
    answers: CheckoutAnswers
    /** Square's price for the answers, prepared on the review step. Cleared whenever an answer changes. */
    summary: PartyCheckoutSummary | null
    preparing: boolean
    /** `editing` until charged; `charging` while the terminal has it; then `paid`, or `canceled` to edit or resend. */
    stage: 'editing' | 'charging' | 'paid' | 'canceled'
    /** The charge on the terminal. */
    onTerminal: Charge | null
    cancelling: boolean
    receiptUrl: string | null
    /** Why the last charge was cancelled, or what went wrong. */
    error: string
    /** The charge couldn't be checked, so it may have been paid: staff check Square before charging again. */
    unclear: boolean
}

type Actions = {
    open: (booking: WithId<FirestoreBooking>) => void
    close: () => void
    /** Called once the booking's config has loaded. Resumes a charge this iPad left on the terminal. */
    init: (input: { config: CheckoutConfig; server: CheckoutServer }) => void
    /** The studio's paired terminals. With exactly one, it's the one charged. */
    setTerminals: (terminals: Terminal[]) => void
    setTerminal: (terminal: Terminal) => void
    setAnswers: (answers: Partial<CheckoutAnswers>) => void
    goTo: (step: CheckoutStep) => void
    prepare: () => Promise<void>
    /** Sends the prepared charge to the terminal and waits for it to finish. */
    charge: () => Promise<void>
    cancel: () => Promise<void>
    /** Back to the first step after a cancelled charge. */
    edit: () => void
    /** Prepares the same answers again and sends them to the terminal. */
    resend: () => Promise<void>
}

const initialState: State = {
    booking: null,
    config: null,
    server: null,
    terminals: null,
    terminal: null,
    step: 'party',
    answers: {
        partyLength: '1.5',
        includesFood: true,
        childrenCount: 12,
        additions: [],
        discountCents: 0,
        discountReason: '',
        giftCardNumber: '',
    },
    summary: null,
    preparing: false,
    stage: 'editing',
    onTerminal: null,
    cancelling: false,
    receiptUrl: null,
    error: '',
    unclear: false,
}

/**
 * Collecting payment for a party: staff confirm the party, children and food, check Square's price, then charge the
 * studio's terminal and wait for the customer to pay. Answers and prices live here; components only render them.
 */
export const useCheckoutStore = create<State & Actions>((set, get) => ({
    ...initialState,

    open: (booking) => set({ ...initialState, booking }),

    close: () => set(initialState),

    init: ({ config, server }) => {
        const { booking } = get()
        if (!booking) return
        const onTerminal = readCharge(booking.id)
        set({ config, server, answers: { ...initialState.answers, ...config.prefill } })
        if (onTerminal) {
            set({ onTerminal, stage: 'charging', step: 'review' })
            void pollCharge(onTerminal)
        }
    },

    setTerminals: (terminals) => {
        const picked = terminals.find((terminal) => terminal.deviceId === get().terminal?.deviceId)
        set({ terminals, terminal: terminals.length === 1 ? terminals[0] : (picked ?? null) })
    },

    setTerminal: (terminal) => set({ terminal }),

    setAnswers: (answers) => {
        set({ answers: { ...get().answers, ...answers }, summary: null, error: '' })
        if (get().step === 'review') void get().prepare()
    },

    goTo: (step) => {
        set({ step, error: '' })
        if (step === 'review' && !get().summary) void get().prepare()
    },

    prepare: async () => {
        const { booking, server, answers } = get()
        if (!booking || !server) return
        set({ preparing: true, summary: null, error: '' })
        // a newer prepare (the answers changed again) replaces this one
        const isCurrent = () => get().answers === answers && get().booking?.id === booking.id
        try {
            const summary = await server.prepare({ bookingId: booking.id, ...answers })
            if (isCurrent()) set({ summary })
        } catch (error) {
            if (isCurrent()) set({ error: getErrorMessage(error) })
        } finally {
            if (isCurrent()) set({ preparing: false })
        }
    },

    charge: async () => {
        const { booking, server, summary, terminal, stage } = get()
        if (!booking || !server || !summary || !terminal || stage === 'charging') return
        set({ stage: 'charging', error: '' })
        try {
            const result = await server.start({
                bookingId: booking.id,
                checkoutId: summary.checkoutId,
                deviceId: terminal.deviceId,
            })
            if (result.status === 'waiting') {
                const onTerminal = { checkoutId: summary.checkoutId, terminalCheckoutId: result.terminalCheckoutId }
                saveCharge(booking.id, onTerminal)
                set({ onTerminal })
                void pollCharge(onTerminal)
            } else {
                settle(result)
            }
        } catch (error) {
            if (isDefiniteFailure(error)) {
                // nothing reached the terminal, so the same answers can be prepared and sent again
                set({ stage: 'canceled', error: getErrorMessage(error) })
            } else {
                // the terminal may have the charge; charging again sends the same one, which Square won't repeat
                set({
                    stage: 'editing',
                    step: 'review',
                    error: "Couldn't confirm the charge reached the terminal. Charge again to check.",
                })
            }
        }
    },

    cancel: async () => {
        const { booking, server, onTerminal, cancelling } = get()
        if (!booking || !server || !onTerminal || cancelling) return
        set({ cancelling: true })
        try {
            await server.cancel({ bookingId: booking.id, ...onTerminal })
        } catch (error) {
            set({ error: getErrorMessage(error) })
        } finally {
            set({ cancelling: false })
        }
        // polling picks up how it ended: cancelled, or paid if the customer got there first
    },

    edit: () => set({ stage: 'editing', step: 'party', summary: null, error: '', unclear: false }),

    resend: async () => {
        set({ stage: 'editing', error: '', unclear: false })
        await get().prepare()
        if (get().summary) await get().charge()
    },
}))

/** Checks the charge until the terminal finishes with it, as long as the dialog is still showing it. */
async function pollCharge(charge: Charge) {
    const isCurrent = () => useCheckoutStore.getState().onTerminal === charge
    let serverErrors = 0
    while (isCurrent()) {
        const { booking, server } = useCheckoutStore.getState()
        if (!booking || !server) return
        try {
            const result = await server.status({ bookingId: booking.id, ...charge })
            if (!isCurrent()) return
            if (result.status !== 'waiting') return settle(result)
            serverErrors = 0
        } catch (error) {
            // a dropped connection mustn't lose track of the charge, but a server that keeps failing can't check it
            if (isServerError(error) && ++serverErrors >= MAX_STATUS_ERRORS && isCurrent()) {
                clearCharge(booking.id)
                useCheckoutStore.setState({
                    stage: 'canceled',
                    unclear: true,
                    error: `Unable to check the payment: ${getErrorMessage(error)}`,
                    onTerminal: null,
                    summary: null,
                })
                return
            }
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
}

function settle(result: Exclude<PartyCheckoutStatus, { status: 'waiting' }>) {
    const { booking } = useCheckoutStore.getState()
    if (booking) clearCharge(booking.id)
    if (result.status === 'paid')
        useCheckoutStore.setState({ stage: 'paid', receiptUrl: result.receiptUrl, onTerminal: null })
    else useCheckoutStore.setState({ stage: 'canceled', error: result.reason, onTerminal: null, summary: null })
}

/** The party price per child and the additions for the answers, before Square prices them on the review step. */
export function estimateCharge(config: CheckoutConfig, answers: CheckoutAnswers) {
    const party = config.partyPrices.find(
        (price) => price.partyLength === answers.partyLength && price.includesFood === answers.includesFood
    )
    const chargedChildren = Math.max(answers.childrenCount, config.minChildren)
    const additions = config.additions.filter((addition) => answers.additions.includes(addition.key))
    const partyCents = (party?.priceCents ?? 0) * chargedChildren
    const additionsCents = additions.reduce((sum, addition) => sum + addition.priceCents, 0)
    return {
        party,
        chargedChildren,
        partyCents,
        additions,
        totalCents: Math.max(partyCents + additionsCents - answers.discountCents, 0),
    }
}

export const toggleAddition = (additions: PartyFormV2Addition[], key: PartyFormV2Addition) =>
    additions.includes(key) ? additions.filter((it) => it !== key) : [...additions, key]

const getErrorCode = (error: unknown) => (error as { data?: { code?: string } }).data?.code

/** The server answered (rather than the connection dropping). */
const isServerError = (error: unknown) => getErrorCode(error) !== undefined

/** The server refused the request, so nothing was charged. Its own failures could have gone either way. */
const isDefiniteFailure = (error: unknown) => isServerError(error) && getErrorCode(error) !== 'INTERNAL_SERVER_ERROR'

function getErrorMessage(error: unknown) {
    return (error as { message?: string }).message || 'Something went wrong. Please try again.'
}
