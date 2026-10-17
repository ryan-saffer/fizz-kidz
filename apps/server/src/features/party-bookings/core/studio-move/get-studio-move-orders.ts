import { isStockedPartyOrder } from '@fizz-kidz/core'
import type { Booking, Studio } from '@fizz-kidz/core'

/**
 * How a party's cake and take-home order follows it to another studio, from where each studio gets its orders: the
 * supplier, or the studio's own stock (Geelong and Werribee). See this folder's README.
 */
export type StudioMoveOrders = 'supplier-to-supplier' | 'stock-to-supplier' | 'supplier-to-stock' | 'stock-to-stock'

export function getStudioMoveOrders(type: Booking['type'], from: Studio, to: Studio): StudioMoveOrders {
    const fromStock = isStockedPartyOrder(type, from)
    const toStock = isStockedPartyOrder(type, to)
    if (fromStock && toStock) return 'stock-to-stock'
    if (fromStock) return 'stock-to-supplier'
    if (toStock) return 'supplier-to-stock'
    return 'supplier-to-supplier'
}
