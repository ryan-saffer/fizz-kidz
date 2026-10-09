import { z } from 'zod'

import { STUDIOS, type Studio } from '../core/studio'

/**
 * Selling our products (the Square 'Products' category, e.g. slime kits) at a studio on its Square Terminal, in place
 * of the Square Point of Sale app. Staff pick the items and quantities, with an optional staff discount and gift card.
 */

const studioSchema = z.custom<Studio>((value) => typeof value === 'string' && STUDIOS.includes(value as Studio))

export const preparePosSchema = z
    .object({
        studio: studioSchema,
        items: z
            .array(z.object({ variationId: z.string().min(1), quantity: z.number().int().min(1).max(50) }))
            .min(1, 'Choose at least one product')
            .refine(
                (items) => new Set(items.map((item) => item.variationId)).size === items.length,
                'Each product is listed once'
            ),
        discountCents: z.number().int().min(0).default(0),
        /** Why staff gave the discount. Kept on the order for us, not shown to the customer. */
        discountReason: z.string().trim().max(200).default(''),
        giftCardNumber: z.string().trim().max(40).default(''),
    })
    .refine((sale) => sale.discountCents === 0 || sale.discountReason.length > 0, {
        message: 'A discount needs a reason',
        path: ['discountReason'],
    })

export type PreparePos = z.infer<typeof preparePosSchema>

export const startPosSchema = z.object({
    studio: studioSchema,
    checkoutId: z.string().min(1),
    deviceId: z.string().min(1),
})

export const posTerminalCheckoutSchema = z.object({
    studio: studioSchema,
    checkoutId: z.string().min(1),
    terminalCheckoutId: z.string().min(1),
})

export type StartPos = z.infer<typeof startPosSchema>
export type PosTerminalCheckout = z.infer<typeof posTerminalCheckoutSchema>

/** A product offered at a studio, priced by Square. */
export type PosOption = {
    variationId: string
    name: string
    description: string | null
    imageUrl: string | null
    priceCents: number
}
