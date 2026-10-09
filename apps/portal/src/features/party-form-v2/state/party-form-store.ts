import { create } from 'zustand'

import {
    MAX_PARTY_FORM_FOOD_ADDITIONS,
    partyFormV2RequiresPayment,
    submitPartyFormV2Schema,
    type PartyFormV2,
    type PartyFormV2Checkout,
    type PartyFormV2Mode,
    type PreparePartyFormV2,
    type SubmitPartyFormV2,
} from '@fizz-kidz/core'

import type { AppRouter } from '@server/app/trpc/app.trpc'

import { toPayload, type FormValues, type PartyFormApi } from './form'
import { getActiveFields, getPartySteps, type PartyStep, type PartyStepKey } from './steps'

import type { inferRouterOutputs } from '@trpc/server'

type PartyProcedures = inferRouterOutputs<AppRouter>['parties']

export type PartyFormV2Config = PartyProcedures['getPartyFormV2Config']

/** A Square cake option: a size, design, flavour, serving or candle choice. */
export type CakeOption = NonNullable<PartyFormV2Config['cakeOptions']>['sizes'][number]

/** The server calls the store makes. `PartyForm` registers them from React Query mutations. */
type PartyFormServer = {
    prepare: (input: PreparePartyFormV2) => Promise<PartyFormV2Checkout>
    submit: (input: SubmitPartyFormV2) => Promise<PartyProcedures['submitPartyFormV2']>
}

/** Unclear payment checks before the customer is asked to contact us rather than keep waiting. */
export const MAX_PAYMENT_CHECKS = 3

type State = {
    config: PartyFormV2Config | null
    mode: PartyFormV2Mode
    form: PartyFormApi | null
    server: PartyFormServer | null
    steps: PartyStep[]
    /** `recovery` is a reload while this tab has a payment it hasn't confirmed. */
    stage: 'welcome' | 'steps' | 'recovery' | 'complete'
    currentStep: number
    stepError: boolean
    advancing: boolean
    receiptUrl: string | null

    // the review step's checkout
    applied: { discountCode: string; giftCardNumber: string }
    payload: PartyFormV2 | null
    checkout: PartyFormV2Checkout | null
    preparing: boolean
    /** The payment request, kept (also in sessionStorage) until it succeeds or definitely fails. */
    attempt: SubmitPartyFormV2 | null
    paying: boolean
    /** Square's outcome was unclear, so the same request is sent again to check. */
    processing: boolean
    paymentChecks: number
    /** A payment definitely failed, so the customer needs a new checkout. */
    needsRefresh: boolean
    error: string
}

type Actions = {
    init: (
        input: Pick<State, 'mode'> & { config: PartyFormV2Config; form: PartyFormApi; server: PartyFormServer }
    ) => void
    start: () => void
    goTo: (index: number) => void
    /** Moves forward once every step before `target` is complete, otherwise shows the first incomplete one. */
    advance: (target?: number) => Promise<void>
    editStep: (key: PartyStepKey) => void
    isStepComplete: (step: PartyStep, values: FormValues) => boolean
    lastReachableStep: (values: FormValues) => number
    prepare: () => Promise<void>
    applyCodes: (codes: Partial<State['applied']>) => void
    pay: (token?: string, buyerVerificationToken?: string) => Promise<void>
    /** Sends the kept payment request: first when paying, then again whenever the outcome was unclear. */
    checkPayment: () => Promise<void>
    startOver: () => void
}

const initialState: State = {
    config: null,
    mode: 'party',
    form: null,
    server: null,
    steps: [],
    stage: 'welcome',
    currentStep: 0,
    stepError: false,
    advancing: false,
    receiptUrl: null,
    applied: { discountCode: '', giftCardNumber: '' },
    payload: null,
    checkout: null,
    preparing: false,
    attempt: null,
    paying: false,
    processing: false,
    paymentChecks: 0,
    needsRefresh: false,
    error: '',
}

/**
 * The party form's journey: steps and validation, the review step's checkout, and paying. Answers and their
 * validators live in the TanStack form (`state/form.ts`); everything else about how the form works is here.
 */
export const usePartyFormStore = create<State & Actions>((set, get) => ({
    ...initialState,

    init: ({ config, mode, form, server }) => {
        const attempt = readPaymentAttempt(config.bookingId)
        set({
            ...initialState,
            config,
            mode,
            form,
            server,
            steps: getPartySteps(config, mode),
            attempt,
            stage: attempt ? 'recovery' : 'welcome',
        })
    },

    start: () => get().goTo(0),

    goTo: (index) => {
        // Back from the first step returns to the welcome screen
        if (index < 0) return set({ stage: 'welcome', currentStep: 0, stepError: false })
        set({ stage: 'steps', currentStep: index, stepError: false })
        if (get().steps[index]?.key === 'review') void get().prepare()
    },

    advance: async (target = get().currentStep + 1) => {
        const { form, steps, advancing } = get()
        if (!form || advancing) return
        set({ advancing: true })
        try {
            const preceding = steps.slice(0, target)
            await Promise.all(
                preceding
                    .flatMap((step) => getActiveFields(step, form.state.values))
                    .map((name) => form.validateField(name, 'submit'))
            )
            const invalid = preceding.findIndex((step) => !get().isStepComplete(step, form.state.values))
            if (invalid >= 0) set({ currentStep: invalid, stepError: true })
            else get().goTo(target)
        } finally {
            set({ advancing: false })
        }
    },

    editStep: (key) => get().goTo(get().steps.findIndex((step) => step.key === key)),

    isStepComplete: (step, values) => {
        const { form, config } = get()
        return getActiveFields(step, values).every((name) => {
            if (form?.getFieldMeta(name)?.errors.length) return false
            if (name === 'creations') return values.creations.length === config?.creationsRequired
            if (name === 'additions') return values.additions.length <= MAX_PARTY_FORM_FOOD_ADDITIONS
            if (name === 'cakeFlavours') {
                const { minFlavours = 1, maxFlavours = 1 } = config?.cakeOptions ?? {}
                return values.cakeFlavours.length >= minFlavours && values.cakeFlavours.length <= maxFlavours
            }
            const value = values[name]
            return typeof value === 'string' && value.trim().length > 0
        })
    },

    lastReachableStep: (values) => {
        const { steps, isStepComplete } = get()
        const firstIncomplete = steps.findIndex((step) => !isStepComplete(step, values))
        return firstIncomplete === -1 ? steps.length - 1 : firstIncomplete
    },

    prepare: async () => {
        const { config, form, mode, server, applied } = get()
        if (!config || !form || !server) return
        const payload = toPayload(config, form.state.values, mode)
        // with nothing paid now there's no checkout: submit sends the answers and the server checks them then
        if (!partyFormV2RequiresPayment(payload)) {
            set({ payload, checkout: null, preparing: false, needsRefresh: false, error: '' })
            return
        }
        set({ payload, checkout: null, preparing: true, needsRefresh: false, error: '' })
        // a newer prepare (e.g. applying a code) replaces this one
        const isCurrent = () => get().payload === payload
        try {
            const checkout = await server.prepare({ payload, ...applied })
            if (isCurrent()) set({ checkout })
        } catch (error) {
            if (isCurrent()) set({ error: getErrorMessage(error) })
        } finally {
            if (isCurrent()) set({ preparing: false })
        }
    },

    applyCodes: (codes) => {
        set({ applied: { ...get().applied, ...codes } })
        void get().prepare()
    },

    pay: async (token = '', buyerVerificationToken = '') => {
        const { config, payload, checkout, preparing, attempt, needsRefresh } = get()
        if (!config || !payload || preparing || attempt) return
        if (partyFormV2RequiresPayment(payload) && (!checkout || needsRefresh)) return
        const request = { payload, checkoutId: checkout?.checkoutId ?? null, token, buyerVerificationToken }
        savePaymentAttempt(config.bookingId, request)
        set({ attempt: request, error: '' })
        await get().checkPayment()
    },

    checkPayment: async () => {
        const { config, server, attempt, paying } = get()
        if (!config || !server || !attempt || paying) return
        set({ paying: true })
        try {
            const result = await server.submit(attempt)
            if (result.status === 'completed') {
                clearPaymentAttempt(config.bookingId)
                set({ stage: 'complete', receiptUrl: result.receiptUrl, attempt: null, processing: false })
            } else {
                set((state) => ({ processing: true, paymentChecks: state.paymentChecks + 1 }))
            }
        } catch (error) {
            const code = (error as { data?: { code?: string } }).data?.code
            if (code && code !== 'INTERNAL_SERVER_ERROR') {
                // a definite failure charges nothing; a paid checkout then needs replacing
                clearPaymentAttempt(config.bookingId)
                set({
                    attempt: null,
                    processing: false,
                    needsRefresh: attempt.checkoutId !== null,
                    error: getErrorMessage(error),
                })
            } else {
                // a lost response may follow a successful charge, so the same request is checked again
                set((state) => ({
                    processing: true,
                    paymentChecks: state.paymentChecks + 1,
                    error: getErrorMessage(error),
                }))
            }
        } finally {
            set({ paying: false })
        }
    },

    startOver: () => set({ stage: 'welcome', attempt: null, needsRefresh: false, error: '' }),
}))

/** The booking's config, form and derived flags. `PartyForm` sets them before rendering anything that reads them. */
export const usePartyConfig = () => usePartyFormStore((state) => state.config!)
export const usePartyFormApi = () => usePartyFormStore((state) => state.form!)
export const useIsCurrentStep = (key: PartyStepKey) =>
    usePartyFormStore((state) => state.stage === 'steps' && state.steps[state.currentStep]?.key === key)
/** While a payment is being made or confirmed, the answers can't change. */
export const useIsCheckoutLocked = () => usePartyFormStore((state) => state.attempt !== null)

function getErrorMessage(error: unknown) {
    return (error as { message?: string }).message || 'Something went wrong. Please try again.'
}

// Only the exact payment request is kept (Square's single-use token, never card details), so a reload in this tab
// checks the same payment instead of starting another. Storage can be unavailable; the in-memory attempt still works.
const attemptKey = (bookingId: string) => `party-form-payment:${bookingId}`

function readPaymentAttempt(bookingId: string): SubmitPartyFormV2 | null {
    try {
        const parsed = submitPartyFormV2Schema.safeParse(
            JSON.parse(sessionStorage.getItem(attemptKey(bookingId)) ?? '')
        )
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

function savePaymentAttempt(bookingId: string, attempt: SubmitPartyFormV2) {
    try {
        sessionStorage.setItem(attemptKey(bookingId), JSON.stringify(attempt))
    } catch {
        /* see above */
    }
}

function clearPaymentAttempt(bookingId: string) {
    try {
        sessionStorage.removeItem(attemptKey(bookingId))
    } catch {
        /* see above */
    }
}
