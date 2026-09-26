import { SquareClient } from '../square.client'

/**
 * Square's price per unit for each variation when `quantity` are ordered at a location, after automatic discounts
 * (for example bulk pricing rules). Nothing is created; this only calculates an order.
 */
export async function calculateCatalogUnitPrices(locationId: string, variationIds: string[], quantity: number) {
    const unitPrices = new Map<string, number>()
    if (variationIds.length === 0) return unitPrices

    const square = await SquareClient.getInstance()
    const { order, errors } = await square.orders.calculate({
        order: {
            locationId,
            pricingOptions: { autoApplyDiscounts: true },
            lineItems: variationIds.map((catalogObjectId) => ({ catalogObjectId, quantity: String(quantity) })),
        },
    })
    if (errors?.length) throw errors[0]
    for (const line of order?.lineItems ?? []) {
        const total = line.totalMoney?.amount
        if (line.catalogObjectId && total !== undefined && total !== null)
            unitPrices.set(line.catalogObjectId, Math.round(Number(total) / quantity))
    }
    return unitPrices
}
