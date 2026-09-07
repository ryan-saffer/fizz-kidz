import { z } from 'zod'

import type { Addition } from './additions'

/**
 * The custom (Paperform-free) party form.
 *
 * Option lists below replicate the production Paperform ('Party Form', tag PROD, slug 4c6karmx) exactly,
 * including its labels. Prices are display-only — the amount actually charged always comes from the
 * Square catalog items referenced in `square-paperform-variation-mappers.ts`.
 * Prices sourced from the production Square catalog on 2026-09-06.
 */

export const PARTY_FORM_V2_SUCCESS_REDIRECT = 'https://fizzkidz.com.au/form-result?result=success'
export const PARTY_FORM_V2_ERROR_REDIRECT = 'https://fizzkidz.com.au/form-result?result=error'

export const BRING_OWN_CAKE = 'I will bring my own cake'

export const PARTY_FORM_CAKES = [
    'Rainbow Ice-Cream Cake',
    'Science Ice-Cream Cake',
    'Slime Ice-Cream Cake',
    'Unicorn Ice-Cream Cake',
    'Chocolate Ice-Cream Cake',
    'Taylor Swift Ice-Cream Cake',
    'Saniro Ice-Cream Cake',
    'Hello Kitty Ice-Cream Cake',
    'Labubo Ice-Cream Cake',
    'Cone Ice-Cream Cake',
    'Minecraft Ice-Cream Cake',
    'K-Pop Ice-Cream Cake',
] as const

export const PARTY_FORM_CAKE_FLAVOURS = [
    'Vanilla',
    'Chocolate',
    'Strawberry',
    'Choc Mint',
    'Banana',
    'Coconut',
    'Salted Caramel',
    'Lemon',
    'Raspberry',
    'Mango',
    'Bubblegum',
    'Fairy Floss',
    'Rainbow',
    'Hokey Pokey (Honeycomb)',
    'Cookies n Cream (not gluten free)',
] as const

export const MAX_CAKE_FLAVOURS = 2
export const MAX_PARTY_FORM_FOOD_ADDITIONS = 3

export const CAKE_SIZES = {
    small_cake: { label: 'Small Ice-Cream Cake (12-15 serves)', price: 89 },
    medium_cake: { label: 'Medium Ice-Cream Cake (15-25 serves)', price: 119 },
    large_cake: { label: 'Large Ice-Cream Cake (25-35 serves)', price: 149 },
} as const

export const CAKE_SERVED_OPTIONS = {
    cup: { label: 'Ice-cream cup with spoon', price: 19 },
    waffle_cones: { label: 'Waffle Cones', price: 19 },
    bring_own_bowls: { label: 'Bring my own serving of bowls/cones', price: 0 },
} as const

export const CAKE_CANDLES_OPTIONS = {
    include_candles: { label: 'Include candles', price: 12 },
    bring_own_candles: { label: 'Bring my own candles', price: 0 },
} as const

export const TAKE_HOME_BAG_PRICE = 6.4
export const PRODUCT_RRP = 19.95
export const PRODUCT_DISCOUNT_PERCENT = 35

/**
 * The additions offered on the production Paperform. A subset of PROD_ADDITIONS —
 * the fizz party packs are not offered on the current form.
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

export const NUMBER_OF_CHILDREN_STUDIO = ['12 - 15', '16 - 20', '21 - 25', '26 - 30'] as const

export const NUMBER_OF_CHILDREN_MOBILE = Array.from({ length: 19 }, (_, i) => String(i + 12))

export const partyFormV2Schema = z.object({
    bookingId: z.string().min(1),
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
    additions: z.array(z.enum(PARTY_FORM_V2_ADDITIONS)).max(MAX_PARTY_FORM_FOOD_ADDITIONS).default([]),
    cake: z
        .object({
            selection: z.enum(PARTY_FORM_CAKES),
            size: z.enum(['small_cake', 'medium_cake', 'large_cake']),
            flavours: z.array(z.enum(PARTY_FORM_CAKE_FLAVOURS)).min(1).max(MAX_CAKE_FLAVOURS),
            served: z.enum(['cup', 'waffle_cones', 'bring_own_bowls']),
            candles: z.enum(['include_candles', 'bring_own_candles']),
            message: z.string().max(30).optional(),
        })
        .optional(),
    takeHomeBags: z
        .object({
            lollyBags: z.number().int().min(0),
            lollyToyMixBags: z.number().int().min(0),
        })
        .partial()
        .default({}),
    products: z
        .object({
            bathBombKit: z.number().int().min(0),
            soapMakingKit: z.number().int().min(0),
            stringSlimeKit: z.number().int().min(0),
            superSlimeKit: z.number().int().min(0),
        })
        .partial()
        .default({}),
    funFacts: z.string().optional(),
    questions: z.string().optional(),
})

export type PartyFormV2 = z.infer<typeof partyFormV2Schema>

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
