import { randomUUID } from 'crypto'

import type { CheckoutProgram, CheckoutSummary } from '@fizz-kidz/core'

import { DISCOUNT_CODE_UID, getDiscountCodeCents, writeCheckoutMetadata } from './checkout-order'

import type { Square } from 'square'

import { throwCustomTrpcError, throwTrpcError } from '@/app/trpc/transport-errors'
import { GiftCardInactiveError } from '@/app/trpc/trpc.errors'
import { checkDiscountCode } from '@/features/discount-codes/core/check-discount-code'
import { checkGiftCardBalance } from '@/features/gift-cards/check-gift-card-balance'
import { getOrCreateCustomer } from '@/integrations/square/core/get-or-create-customer'
import { SquareClient } from '@/integrations/square/square.client'

export type PrepareCheckoutInput = {
    program: CheckoutProgram
    /** Shown as the order's source in Square, e.g. 'Party Form'. */
    sourceName: string
    locationId: string
    customer: { firstName: string; lastName: string; email: string }
    /**
     * What is being bought, priced by the server: Square catalogue items, or names and amounts the booking flow
     * looked up itself. Never amounts sent by the browser.
     */
    lineItems: Square.OrderLineItem[]
    /** Discounts the booking flow priced itself, applied to line items through their `appliedDiscounts`. */
    discounts?: Square.OrderLineItemDiscount[]
    /** Extra order metadata for the booking flow, such as its booking id. */
    metadata?: Record<string, string>
    discountCode?: string
    giftCardNumber?: string
}

/**
 * Prices the line items in Square (including automatic discounts), applies the customer's discount code and gift card,
 * and creates an unpaid Square order to pay with `payCheckout`. Nothing is charged and nothing is stored in our
 * database; the order is the checkout.
 */
export async function prepareCheckout(input: PrepareCheckoutInput): Promise<CheckoutSummary> {
    if (input.lineItems.length === 0) throw new Error('A checkout needs at least one line item')

    const square = await SquareClient.getInstance()
    const customerId = await getOrCreateCustomer(
        input.customer.firstName,
        input.customer.lastName,
        input.customer.email
    )
    const orderInput: Square.Order = {
        locationId: input.locationId,
        customerId,
        source: { name: input.sourceName },
        pricingOptions: { autoApplyDiscounts: true },
        lineItems: input.lineItems,
        discounts: input.discounts,
    }

    const calculated = (await square.orders.calculate({ order: orderInput })).order
    const subtotalCents = Number(calculated?.totalMoney?.amount ?? 0)

    let discount: { id: string; code: string; cents: number } | null = null
    if (input.discountCode) {
        const code = await checkDiscountCode(input.discountCode, input.customer.email)
        if (typeof code === 'string') throwTrpcError('BAD_REQUEST', `Discount code is ${code}.`)
        discount = { id: code.id, code: code.code, cents: getDiscountCodeCents(code, subtotalCents) }
        orderInput.discounts = [
            ...(input.discounts ?? []),
            {
                uid: DISCOUNT_CODE_UID,
                name: `Discount code '${code.code}'`,
                scope: 'ORDER',
                type: 'FIXED_AMOUNT',
                amountMoney: { currency: 'AUD', amount: BigInt(discount.cents) },
            },
        ]
    }
    const totalCents = subtotalCents - (discount?.cents ?? 0)

    let giftCard = { id: '', cents: 0, last4: '' }
    if (input.giftCardNumber && totalCents > 0) {
        const balance = await checkGiftCardBalance(input.giftCardNumber)
        if (balance.state !== 'ACTIVE') throwCustomTrpcError(new GiftCardInactiveError())
        if (balance.balanceCents <= 0) throwTrpcError('BAD_REQUEST', 'This gift card has no remaining balance.')
        giftCard = { id: balance.giftCardId, cents: Math.min(totalCents, balance.balanceCents), last4: balance.last4 }
    }

    orderInput.metadata = {
        ...input.metadata,
        ...writeCheckoutMetadata({
            program: input.program,
            customerEmail: input.customer.email,
            customerName: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
            discountCode: discount?.code ?? '',
            discountCodeId: discount?.id ?? '',
            giftCardId: giftCard.id,
            giftCardCents: giftCard.cents,
        }),
    }
    const { order } = await square.orders.create({ idempotencyKey: randomUUID(), order: orderInput })
    if (!order?.id) throw new Error('Square returned no checkout order')

    return {
        checkoutId: order.id,
        locationId: input.locationId,
        customerEmail: input.customer.email,
        subtotalCents,
        discountCents: discount?.cents ?? 0,
        discountCode: discount?.code ?? '',
        totalCents,
        giftCardCents: giftCard.cents,
        giftCardLast4: giftCard.last4,
        cardCents: totalCents - giftCard.cents,
        items: describeLineItems(calculated?.lineItems ?? []),
    }
}

/** One line per item, followed by any options that cost extra. Free options stay on the order but aren't listed. */
function describeLineItems(lines: Square.OrderLineItem[]) {
    return lines.flatMap((line) => {
        const modifiers = (line.modifiers ?? [])
            .map((modifier) => ({
                label: modifier.name ?? 'Option',
                amountCents: Number(modifier.totalPriceMoney?.amount ?? 0),
            }))
            .filter((modifier) => modifier.amountCents > 0)
        return [
            {
                label: `${line.quantity} × ${line.name ?? 'Item'}`,
                amountCents:
                    Number(line.totalMoney?.amount ?? 0) -
                    modifiers.reduce((sum, modifier) => sum + modifier.amountCents, 0),
            },
            ...modifiers,
        ]
    })
}
