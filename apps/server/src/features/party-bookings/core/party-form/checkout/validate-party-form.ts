import {
    getActiveBirthdayPartyBookingPackages,
    getPartyCakeSource,
    getPartyCreationCount,
    getTakeHomeMinimum,
    mapProductToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    MIN_TAKE_HOME_QUANTITY,
    NUMBER_OF_CHILDREN_MOBILE,
    NUMBER_OF_CHILDREN_STUDIO,
    orderedQuantities,
    type Booking,
    type PartyForm,
    type PartyFormPartyAnswers,
    type ProductType,
} from '@fizz-kidz/core'

import { getPartyFormCakeOptions, getStockedPartyFormCakeOptions } from '../options/get-party-form-cake-options'
import { getPartyFormTakeHomeOptions } from '../options/get-party-form-take-home-options'

import type { PartyFormTakeHomeOptions } from '../options/get-party-form-take-home-options'
import type { Square } from 'square'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { SanityClient } from '@/integrations/sanity/sanity.client'

const NO_LONGER_AVAILABLE = 'The form contains selections that are no longer available.'

/**
 * Checks the answers against the booking, and builds what's paid now: the cake and take-home goodies as Square line
 * items (food is paid at the end of the party). Creations Sanity no longer offers for the party fail here; other choices
 * Square no longer offers fail here or when Square prices the order. The cake form (`mode: 'cake'`) skips the party questions.
 */
export async function validatePartyForm(payload: PartyForm) {
    const booking = await DatabaseClient.getPartyBooking(payload.bookingId)
    if (payload.mode === 'party') await validatePartyAnswers(payload, booking)

    const cakeSource = getPartyCakeSource(booking.type, booking.location)
    if (payload.cake && (!cakeSource || (cakeSource === 'studio-stock' && payload.mode !== 'party')))
        throwTrpcError('BAD_REQUEST', 'Cakes are not available for this party.')
    if (payload.cake && booking.cake) throwTrpcError('BAD_REQUEST', 'A cake has already been ordered for this party.')
    const takeHomeBags = orderedQuantities(payload.takeHomeBags)
    const products = orderedQuantities(payload.products)
    if (
        takeHomeBags.some(([key, quantity]) => quantity < getTakeHomeMinimum(booking.takeHomeBags?.[key])) ||
        products.some(([key, quantity]) => quantity < getTakeHomeMinimum(booking.products?.[key]))
    )
        throwTrpcError('BAD_REQUEST', `Take-home items have a minimum of ${MIN_TAKE_HOME_QUANTITY}.`)
    if (cakeSource === 'studio-stock' && (takeHomeBags.length > 0 || products.length > 0))
        assertTakeHomeInStock(await getPartyFormTakeHomeOptions(booking.location), takeHomeBags, products)

    const discounts = await getKitTopUpDiscounts(products, booking)
    const lineItems: Square.OrderLineItem[] = [
        ...(payload.cake ? [await buildCakeLine(payload.cake, booking, cakeSource === 'studio-stock')] : []),
        ...takeHomeBags.map(([key, quantity]) => ({
            quantity: String(quantity),
            catalogObjectId: mapTakeHomeBagToSquareVariation(env, key),
        })),
        ...products.map(([key, quantity]) => ({
            quantity: String(quantity),
            catalogObjectId: mapProductToSquareVariation(env, key),
            appliedDiscounts: discounts.some((discount) => discount.uid === key) ? [{ discountUid: key }] : undefined,
        })),
    ]
    if (payload.mode === 'cake' && lineItems.length === 0)
        throwTrpcError('BAD_REQUEST', 'Please choose a cake or take-home goodies to order.')
    return { booking, lineItems, discounts }
}

/** The party details questions, which only the full party form asks. */
async function validatePartyAnswers(payload: PartyFormPartyAnswers, booking: Booking) {
    const childCounts: readonly string[] =
        booking.type === 'studio' ? NUMBER_OF_CHILDREN_STUDIO : NUMBER_OF_CHILDREN_MOBILE
    if (!childCounts.includes(payload.numberOfChildren))
        throwTrpcError('BAD_REQUEST', 'Please select the number of children.')
    if (booking.type === 'studio' && !payload.foodPackage) throwTrpcError('BAD_REQUEST', 'Please choose a food option.')
    if (booking.type === 'mobile' && (payload.foodPackage || payload.additions.length))
        throwTrpcError('BAD_REQUEST', 'Food options are only available for studio parties.')
    const creationKeys = payload.creations.flatMap((group) => group.creationKeys)
    if (
        creationKeys.length !== getPartyCreationCount(booking) ||
        new Set(creationKeys).size !== creationKeys.length ||
        new Set(payload.creations.map((group) => group.packageKey)).size !== payload.creations.length
    ) {
        throwTrpcError('BAD_REQUEST', `Please select exactly ${getPartyCreationCount(booking)} different creations.`)
    }
    const catalogue = await (await SanityClient.getInstance()).getBirthdayPartyBookingCatalogue()
    const offered = getActiveBirthdayPartyBookingPackages(catalogue, booking.type)
    const isOffered = (packageKey: string, creationKey: string) =>
        offered.some(
            (item) => item.key === packageKey && item.creations.some((creation) => creation.key === creationKey)
        )
    if (payload.creations.some((group) => group.creationKeys.some((key) => !isOffered(group.packageKey, key))))
        throwTrpcError('BAD_REQUEST', NO_LONGER_AVAILABLE)
}

/**
 * The cake as one line: its size variation plus serving, candle, design and flavour modifiers from Square. Studio-stock
 * cakes must be a design the studio still has available, in the stocked size and flavours.
 */
async function buildCakeLine(
    cake: NonNullable<PartyForm['cake']>,
    booking: Booking,
    isStocked: boolean
): Promise<Square.OrderLineItem> {
    const { selection, size, flavours, served, candles } = cake
    const options = isStocked
        ? await getStockedPartyFormCakeOptions(booking.location)
        : await getPartyFormCakeOptions(booking.location)
    if (isStocked && !options.designs.some((design) => design.name === selection && !design.soldOut))
        throwTrpcError('BAD_REQUEST', `Sorry, the ${selection} cake has just sold out. Please choose another.`)
    const find = (list: { id: string; name: string }[], name: string) => list.find((option) => option.name === name)
    const chosen = {
        size: find(options.sizes, size),
        design: find(options.designs, selection),
        served: find(options.servingOptions, served),
        candles: find(options.candleOptions, candles),
        flavours: flavours.map((name) => find(options.flavours, name)),
    }
    if (
        !chosen.size ||
        !chosen.design ||
        !chosen.served ||
        !chosen.candles ||
        chosen.flavours.some((item) => !item) ||
        new Set(flavours).size !== flavours.length
    )
        throwTrpcError('BAD_REQUEST', NO_LONGER_AVAILABLE)
    if (flavours.length < options.minFlavours || flavours.length > options.maxFlavours)
        throwTrpcError(
            'BAD_REQUEST',
            `Please choose between ${options.minFlavours} and ${options.maxFlavours} cake flavours.`
        )
    return {
        quantity: '1',
        name: `${selection} - ${size}`,
        catalogObjectId: chosen.size.id,
        modifiers: [chosen.served, chosen.candles, chosen.design, ...chosen.flavours].flatMap((item) =>
            item ? [{ catalogObjectId: item.id, quantity: '1' }] : []
        ),
    }
}

/** Studio stock can't be oversold: each linked bag or kit must have enough available. */
function assertTakeHomeInStock(
    options: PartyFormTakeHomeOptions,
    takeHomeBags: [string, number][],
    products: [string, number][]
) {
    const check = (
        offered: { key: string; name: string; available: number | null }[],
        [key, quantity]: [string, number]
    ) => {
        const option = offered.find((item) => item.key === key)
        if (option?.available != null && quantity > option.available)
            throwTrpcError(
                'BAD_REQUEST',
                `Sorry, only ${option.available} ${option.name} are left. Please choose a smaller quantity.`
            )
    }
    takeHomeBags.forEach((line) => check(options.takeHomeBags, line))
    products.forEach((line) => check(options.products, line))
}

/**
 * Square's kit bulk price needs 12 kits in one order, so a top-up of fewer kits for a party that already has 12 is
 * discounted down to the bulk price the form showed.
 */
async function getKitTopUpDiscounts(
    ordered: [ProductType, number][],
    booking: Booking
): Promise<Square.OrderLineItemDiscount[]> {
    const total = (quantities: [ProductType, number][]) => quantities.reduce((sum, [, quantity]) => sum + quantity, 0)
    const orderedTotal = total(ordered)
    if (
        total(orderedQuantities(booking.products)) < MIN_TAKE_HOME_QUANTITY ||
        orderedTotal === 0 ||
        orderedTotal >= MIN_TAKE_HOME_QUANTITY
    )
        return []
    const { products: offered } = await getPartyFormTakeHomeOptions(booking.location)
    return ordered.flatMap(([key, quantity]) => {
        const option = offered.find((item) => item.key === key)
        const cents = option ? (option.regularPriceCents - option.priceCents) * quantity : 0
        if (cents <= 0) return []
        return {
            uid: key,
            name: 'Take-home kit bulk price',
            scope: 'LINE_ITEM',
            type: 'FIXED_AMOUNT',
            amountMoney: { currency: 'AUD', amount: BigInt(cents) },
        }
    })
}
