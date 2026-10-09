import { z } from 'zod'

import type { CheckoutSummary } from '../payments/checkout'
import type { Addition } from './additions'

/**
 * The custom (Paperform-free) party form.
 *
 * The number-of-children options mirror the production Paperform ('Party Form', tag PROD, slug 4c6karmx). The
 * ice-cream cake, food additions and take-home goodies come from Square, and creations from Sanity.
 */

export const BRING_OWN_CAKE = 'I will bring my own cake'

export const MAX_PARTY_FORM_FOOD_ADDITIONS = 3

/** Take-home bags and kits are sold in lots of at least 12, matching the Paperform. */
export const MIN_TAKE_HOME_QUANTITY = 12

/** The smallest new order of a take-home item. Once 12 are ordered, parents can top up by any amount (e.g. late RSVPs). */
export function getTakeHomeMinimum(alreadyOrdered: number | undefined) {
    return alreadyOrdered ? 1 : MIN_TAKE_HOME_QUANTITY
}

/** The minimum depends on the booking's earlier orders, so prepare checks it (see `getTakeHomeMinimum`). */
const takeHomeQuantity = z.number().int().min(0)

/**
 * Addition keys the custom form can store. Which ones are offered, and their names, photos and prices,
 * come from the Square 'Additional Options' category (see `square-party-additions.ts`).
 */
export const PARTY_FORM_V2_ADDITIONS = [
    'chickenNuggets',
    'fairyBread',
    'fruitPlatter',
    'frankfurts',
    'sandwichPlatter',
    'vegetarianQuiche',
    'watermelonPlatter',
    'wedges',
] as const satisfies readonly Addition[]

export type PartyFormV2Addition = (typeof PARTY_FORM_V2_ADDITIONS)[number]

export const NUMBER_OF_CHILDREN_STUDIO = ['12 - 15', '16 - 20', '21 - 25', '26 - 30'] as const

export const NUMBER_OF_CHILDREN_MOBILE = Array.from({ length: 19 }, (_, i) => String(i + 12))

/**
 * `party` is the full party details form. `cake` only orders a cake and take-home goodies ahead of the party (the
 * Paperform's 'cake form'), and is sent from booking time onwards.
 */
export type PartyFormV2Mode = 'party' | 'cake'

/** What can be paid for in advance, in either mode. */
const orderFields = {
    bookingId: z.string().min(1),
    cake: z
        .object({
            /** Every cake answer is the name of an option on the Square cake item (see `square-party-cake.ts`). */
            selection: z.string().trim().min(1).max(200),
            size: z.string().trim().min(1).max(200),
            flavours: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
            served: z.string().trim().min(1).max(200),
            candles: z.string().trim().min(1).max(200),
            message: z.string().max(30).optional(),
        })
        .optional(),
    takeHomeBags: z
        .object({
            lollyBags: takeHomeQuantity,
            lollyToyMixBags: takeHomeQuantity,
        })
        .partial()
        .default({}),
    products: z
        .object({
            bathBombKit: takeHomeQuantity,
            soapMakingKit: takeHomeQuantity,
            stringSlimeKit: takeHomeQuantity,
            superSlimeKit: takeHomeQuantity,
        })
        .partial()
        .default({}),
}

export const partyFormV2Schema = z.discriminatedUnion('mode', [
    z.object({
        mode: z.literal('party'),
        ...orderFields,
        parentFirstName: z.string().min(1),
        parentLastName: z.string().min(1),
        childName: z.string().min(1),
        childAge: z.string().min(1),
        numberOfChildren: z.string().min(1),
        creations: z.array(
            z.object({
                packageKey: z.string().min(1),
                creationKeys: z.array(z.string().min(1)),
            })
        ),
        foodPackage: z.enum(['include', 'self-cater']).optional(),
        additions: z
            .array(z.enum(PARTY_FORM_V2_ADDITIONS))
            .max(MAX_PARTY_FORM_FOOD_ADDITIONS)
            .refine((additions) => new Set(additions).size === additions.length, 'Additions must be unique')
            .default([]),
        funFacts: z.string().optional(),
        questions: z.string().optional(),
    }),
    z.object({ mode: z.literal('cake'), ...orderFields }),
])

export type PartyFormV2 = z.infer<typeof partyFormV2Schema>
export type PartyFormV2PartyAnswers = Extract<PartyFormV2, { mode: 'party' }>

export const preparePartyFormV2Schema = z.object({
    payload: partyFormV2Schema,
    discountCode: z.string().trim().max(100).default(''),
    giftCardNumber: z.string().trim().max(40).default(''),
})

/** The answers are sent again with the payment; the server checks they're the ones the checkout was prepared for. */
export const submitPartyFormV2Schema = z.object({
    payload: partyFormV2Schema,
    checkoutId: z.string().min(1).max(100).nullable(),
    token: z.string().max(500).default(''),
    buyerVerificationToken: z.string().max(500).default(''),
})

export type PreparePartyFormV2 = z.infer<typeof preparePartyFormV2Schema>
export type SubmitPartyFormV2 = z.infer<typeof submitPartyFormV2Schema>

/** The party form's checkout summary. `checkoutId` is null when nothing is paid now. */
export type PartyFormV2Checkout = Omit<CheckoutSummary, 'checkoutId'> & { checkoutId: string | null }

/** A submitted party or cake form, kept so it can be checked against the booking (like Paperform's submissions list). */
export type PartyFormSubmission = {
    id: string
    bookingId: string
    payload: PartyFormV2
    /** The Square order that paid for it, or null when nothing was charged. */
    checkoutId: string | null
    /** Set once the answers are applied to the booking, so a replay doesn't apply them twice. */
    bookingApplied: boolean
    createdAt: Date
}

/**
 * Returns the entries of a quantity record (take home bags, products) with a quantity above zero.
 */
export function orderedQuantities<T extends string>(record: Partial<Record<T, number>> | undefined): [T, number][] {
    return (Object.entries(record ?? {}) as [T, number | undefined][]).filter(
        (entry): entry is [T, number] => !!entry[1] && entry[1] > 0
    )
}

export function partyFormV2RequiresPayment(payload: Pick<PartyFormV2, 'cake' | 'takeHomeBags' | 'products'>) {
    return (
        Boolean(payload.cake) ||
        orderedQuantities(payload.takeHomeBags).length > 0 ||
        orderedQuantities(payload.products).length > 0
    )
}
