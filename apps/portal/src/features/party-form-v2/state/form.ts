import { useForm } from '@tanstack/react-form'

import {
    BRING_OWN_CAKE,
    partyFormV2Schema,
    type PartyFormV2,
    type PartyFormV2Addition,
    type PartyFormV2Mode,
    type PRODUCTS,
    type TAKE_HOME_BAGS,
} from '@fizz-kidz/core'

import type { PartyFormV2Config } from './party-form-store'

export type CreationSelection = { packageKey: string; creationKey: string }

export type FormValues = {
    parentFirstName: string
    parentLastName: string
    childName: string
    childAge: string
    numberOfChildren: string
    creations: CreationSelection[]
    foodPackage: 'include' | 'self-cater' | ''
    additions: PartyFormV2Addition[]
    cakeSelection: string
    cakeSize: string
    cakeFlavours: string[]
    cakeServed: string
    cakeCandles: string
    cakeMessage: string
    takeHomeBags: Record<keyof typeof TAKE_HOME_BAGS, number>
    products: Record<keyof typeof PRODUCTS, number>
    funFacts: string
    questions: string
}

/** The TanStack form holding the answers and their validators. The party form store drives it. */
export function useCreatePartyForm(config: PartyFormV2Config) {
    return useForm({ defaultValues: getDefaultValues(config) })
}

export type PartyFormApi = ReturnType<typeof useCreatePartyForm>

function getDefaultValues(config: PartyFormV2Config): FormValues {
    return {
        parentFirstName: config.prefill.parentFirstName,
        parentLastName: config.prefill.parentLastName,
        childName: config.prefill.childName,
        childAge: config.prefill.childAge,
        numberOfChildren: '',
        creations: [],
        foodPackage: config.type === 'studio' ? (config.prefill.includesFood ? 'include' : 'self-cater') : '',
        additions: [],
        cakeSelection: BRING_OWN_CAKE,
        cakeSize: '',
        cakeFlavours: [],
        cakeServed: '',
        cakeCandles: '',
        cakeMessage: '',
        takeHomeBags: { lollyBags: 0, lollyToyMixBags: 0 },
        products: { bathBombKit: 0, soapMakingKit: 0, stringSlimeKit: 0, superSlimeKit: 0 },
        funFacts: '',
        questions: '',
    }
}

export function required(message: string) {
    return ({ value }: { value: string }) => (value.trim() ? undefined : message)
}

/** Validates a cake question only while a cake (rather than bringing your own) is selected. */
export function requiredForCake<T extends string | string[]>(message: string, isAnswered: (value: T) => boolean) {
    return ({
        value,
        fieldApi,
    }: {
        value: T
        fieldApi: { form: { getFieldValue: (name: 'cakeSelection') => string } }
    }) => {
        const cake = fieldApi.form.getFieldValue('cakeSelection')
        return cake && cake !== BRING_OWN_CAKE && !isAnswered(value) ? message : undefined
    }
}

/** The answers sent to the server. The cake form (`mode: 'cake'`) only sends the cake and take-home goodies. */
export function toPayload(config: PartyFormV2Config, value: FormValues, mode: PartyFormV2Mode): PartyFormV2 {
    const order = {
        bookingId: config.bookingId,
        ...(config.cakeOptions &&
            !config.alreadyPurchased.cake &&
            value.cakeSelection &&
            value.cakeSelection !== BRING_OWN_CAKE && {
                cake: {
                    selection: value.cakeSelection,
                    size: value.cakeSize,
                    flavours: value.cakeFlavours,
                    served: value.cakeServed,
                    candles: value.cakeCandles,
                    ...(value.cakeMessage.trim() && { message: value.cakeMessage.trim() }),
                },
            }),
        takeHomeBags: Object.fromEntries(Object.entries(value.takeHomeBags).filter(([, quantity]) => quantity > 0)),
        products: Object.fromEntries(Object.entries(value.products).filter(([, quantity]) => quantity > 0)),
    }
    if (mode === 'cake') return partyFormV2Schema.parse({ mode: 'cake', ...order })

    const creations = new Map<string, string[]>()
    for (const selection of value.creations)
        creations.set(selection.packageKey, [...(creations.get(selection.packageKey) ?? []), selection.creationKey])
    return partyFormV2Schema.parse({
        mode: 'party',
        ...order,
        parentFirstName: value.parentFirstName.trim(),
        parentLastName: value.parentLastName.trim(),
        childName: value.childName.trim(),
        childAge: value.childAge.trim(),
        numberOfChildren: value.numberOfChildren,
        creations: [...creations].map(([packageKey, creationKeys]) => ({ packageKey, creationKeys })),
        ...(config.type === 'studio' && { foodPackage: value.foodPackage }),
        additions: config.type === 'studio' ? value.additions : [],
        ...(value.funFacts.trim() && { funFacts: value.funFacts.trim() }),
        ...(value.questions.trim() && { questions: value.questions.trim() }),
    })
}
