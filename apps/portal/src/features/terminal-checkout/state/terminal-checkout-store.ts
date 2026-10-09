import { create } from 'zustand'

import type { CheckoutSummary, TerminalCheckoutStatus } from '@fizz-kidz/core'

import { clearCharge, readCharge, saveCharge } from './charge-storage'

/** A Square Terminal paired with the portal at the studio. */
export type Terminal = { deviceId: string; name: string }

/** A charge sent to the terminal: the Square order and the terminal checkout paying it. */
export type Charge = { checkoutId: string; terminalCheckoutId: string }

/** The staff discount and gift card every terminal checkout offers on its review step. */
export type CheckoutAdjustments = { discountCents: number; discountReason: string; giftCardNumber: string }

/**
 * The server calls the store makes, for what's being charged (e.g. a booking). The checkout's dialog registers them
 * from React Query mutations.
 */
export type TerminalCheckoutServer<Answers> = {
    prepare: (answers: Answers) => Promise<CheckoutSummary>
    start: (input: { checkoutId: string; deviceId: string }) => Promise<TerminalCheckoutStatus>
    status: (charge: Charge) => Promise<TerminalCheckoutStatus>
    cancel: (charge: Charge) => Promise<unknown>
}

/** The review step, where the charge is sent to the terminal, always comes last. */
export const REVIEW_STEP = 'review'

export type TerminalCheckoutState<Subject, Config, Answers extends CheckoutAdjustments> = {
    /** What's being charged, e.g. a party booking. `null` while the checkout is closed. */
    subject: Subject | null
    /** What it can be charged, e.g. Square's prices, once loaded. */
    config: Config | null
    server: TerminalCheckoutServer<Answers> | null
    /** The steps before the review step, then the review step. */
    steps: readonly { key: string; label: string }[]
    /** The terminals paired at the studio, once loaded. */
    terminals: Terminal[] | null
    /** The terminal to charge: the studio's own, or the one picked when there's more than one (the sandbox). */
    terminal: Terminal | null
    step: string
    answers: Answers
    /** Square's price for the answers, prepared on the review step. Cleared whenever an answer changes. */
    summary: CheckoutSummary | null
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

export type TerminalCheckoutActions<Subject, Config, Answers extends CheckoutAdjustments> = {
    open: (subject: Subject) => void
    close: () => void
    /**
     * Called once the subject's config has loaded, with any answers it starts from. Resumes a charge this iPad left on
     * the terminal.
     */
    init: (input: { config: Config; server: TerminalCheckoutServer<Answers>; answers?: Partial<Answers> }) => void
    /** The studio's paired terminals. With exactly one, it's the one charged. */
    setTerminals: (terminals: Terminal[]) => void
    setTerminal: (terminal: Terminal) => void
    setAnswers: (answers: Partial<Answers>) => void
    goTo: (step: string) => void
    prepare: () => Promise<void>
    /** Sends the prepared charge to the terminal and waits for it to finish. */
    charge: () => Promise<void>
    cancel: () => Promise<void>
    /** Back to the first step after a cancelled charge. */
    edit: () => void
    /** Prepares the same answers again and sends them to the terminal. */
    resend: () => Promise<void>
    /** A fresh charge for the same subject after a paid one, e.g. the next customer's sale. */
    startOver: () => void
}

export type TerminalCheckoutStore<Subject, Config, Answers extends CheckoutAdjustments> = TerminalCheckoutState<
    Subject,
    Config,
    Answers
> &
    TerminalCheckoutActions<Subject, Config, Answers>

const POLL_INTERVAL_MS = 2000
/** Server errors in a row before giving up on checking a charge. Dropped connections keep retrying. */
const MAX_STATUS_ERRORS = 5

/**
 * A checkout charged on the studio's Square Terminal: staff fill in the steps, check Square's price on the review step,
 * then charge the terminal and wait for the customer to pay. Each checkout (a party, a product sale) makes its own
 * store with its own steps and answers; how a charge is sent, checked, cancelled and resent is the same for all.
 */
export function createTerminalCheckoutStore<Subject, Config, Answers extends CheckoutAdjustments>(options: {
    /** Names the charge this iPad keeps across reloads, e.g. 'party-checkout-charge'. */
    storageKey: string
    /** Identifies the subject, e.g. its booking id. A charge on the terminal is kept per subject. */
    getSubjectId: (subject: Subject) => string
    /** The steps before the review step. */
    steps: readonly { key: string; label: string }[]
    initialAnswers: Answers
}) {
    type Store = TerminalCheckoutStore<Subject, Config, Answers>

    const steps = [...options.steps, { key: REVIEW_STEP, label: 'Review & charge' }]
    const fresh = {
        step: steps[0].key,
        answers: options.initialAnswers,
        summary: null,
        preparing: false,
        stage: 'editing',
        onTerminal: null,
        cancelling: false,
        receiptUrl: null,
        error: '',
        unclear: false,
    } as const satisfies Partial<TerminalCheckoutState<Subject, Config, Answers>>
    const initialState: TerminalCheckoutState<Subject, Config, Answers> = {
        subject: null,
        config: null,
        server: null,
        steps,
        terminals: null,
        terminal: null,
        ...fresh,
    }
    const chargeKey = (subject: Subject) => `${options.storageKey}:${options.getSubjectId(subject)}`

    const useStore = create<Store>((set, get) => ({
        ...initialState,

        open: (subject) => set({ ...initialState, subject }),

        close: () => set(initialState),

        init: ({ config, server, answers }) => {
            const { subject } = get()
            if (!subject) return
            const onTerminal = readCharge(chargeKey(subject))
            set({ config, server, answers: { ...options.initialAnswers, ...answers } })
            if (onTerminal) {
                set({ onTerminal, stage: 'charging', step: REVIEW_STEP })
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
            if (get().step === REVIEW_STEP) void get().prepare()
        },

        goTo: (step) => {
            set({ step, error: '' })
            if (step === REVIEW_STEP && !get().summary) void get().prepare()
        },

        prepare: async () => {
            const { subject, server, answers } = get()
            if (!subject || !server) return
            set({ preparing: true, summary: null, error: '' })
            // a newer prepare (the answers changed again, or another subject) replaces this one
            const isCurrent = () => get().answers === answers && get().subject === subject
            try {
                const summary = await server.prepare(answers)
                if (isCurrent()) set({ summary })
            } catch (error) {
                if (isCurrent()) set({ error: getErrorMessage(error) })
            } finally {
                if (isCurrent()) set({ preparing: false })
            }
        },

        charge: async () => {
            const { subject, server, summary, terminal, stage } = get()
            if (!subject || !server || !summary || !terminal || stage === 'charging') return
            set({ stage: 'charging', error: '' })
            try {
                const result = await server.start({ checkoutId: summary.checkoutId, deviceId: terminal.deviceId })
                if (result.status === 'waiting') {
                    const onTerminal = { checkoutId: summary.checkoutId, terminalCheckoutId: result.terminalCheckoutId }
                    saveCharge(chargeKey(subject), onTerminal)
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
                        step: REVIEW_STEP,
                        error: "Couldn't confirm the charge reached the terminal. Charge again to check.",
                    })
                }
            }
        },

        cancel: async () => {
            const { server, onTerminal, cancelling } = get()
            if (!server || !onTerminal || cancelling) return
            set({ cancelling: true })
            try {
                await server.cancel(onTerminal)
            } catch (error) {
                set({ error: getErrorMessage(error) })
            } finally {
                set({ cancelling: false })
            }
            // polling picks up how it ended: cancelled, or paid if the customer got there first
        },

        edit: () => set({ stage: 'editing', step: steps[0].key, summary: null, error: '', unclear: false }),

        resend: async () => {
            set({ stage: 'editing', error: '', unclear: false })
            await get().prepare()
            if (get().summary) await get().charge()
        },

        startOver: () => {
            if (get().stage === 'paid') set(fresh)
        },
    }))

    /** Checks the charge until the terminal finishes with it, as long as the checkout is still showing it. */
    async function pollCharge(charge: Charge) {
        const isCurrent = () => useStore.getState().onTerminal === charge
        let serverErrors = 0
        while (isCurrent()) {
            const { subject, server } = useStore.getState()
            if (!subject || !server) return
            try {
                const result = await server.status(charge)
                if (!isCurrent()) return
                if (result.status !== 'waiting') return settle(result)
                serverErrors = 0
            } catch (error) {
                // a dropped connection mustn't lose track of the charge, but a server that keeps failing can't check it
                if (isServerError(error) && ++serverErrors >= MAX_STATUS_ERRORS && isCurrent()) {
                    clearCharge(chargeKey(subject))
                    useStore.setState({
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

    function settle(result: Exclude<TerminalCheckoutStatus, { status: 'waiting' }>) {
        const { subject } = useStore.getState()
        if (subject) clearCharge(chargeKey(subject))
        if (result.status === 'paid')
            useStore.setState({ stage: 'paid', receiptUrl: result.receiptUrl, onTerminal: null })
        else useStore.setState({ stage: 'canceled', error: result.reason, onTerminal: null, summary: null })
    }

    return useStore
}

const getErrorCode = (error: unknown) => (error as { data?: { code?: string } }).data?.code

/** The server answered (rather than the connection dropping). */
const isServerError = (error: unknown) => getErrorCode(error) !== undefined

/** The server refused the request, so nothing was charged. Its own failures could have gone either way. */
const isDefiniteFailure = (error: unknown) => isServerError(error) && getErrorCode(error) !== 'INTERNAL_SERVER_ERROR'

function getErrorMessage(error: unknown) {
    return (error as { message?: string }).message || 'Something went wrong. Please try again.'
}
