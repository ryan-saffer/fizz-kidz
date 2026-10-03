import { capitalise, getIsInventoryRunningLow, isOrderableInventoryItem } from '@fizz-kidz/core'
import type { InventoryItem, InventoryStockLevel, InventoryStockMovement, Studio } from '@fizz-kidz/core'

import { getInventoryOwnerEmails } from './inventory.owners'

import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

export type InventoryStockWrite = {
    item: InventoryItem
    before: InventoryStockLevel | undefined
    stockLevel: InventoryStockLevel
    movement: InventoryStockMovement
}

export type InventoryAlert = { title: string; detail: string }

/** Alerts the studio owners need to act on after these stock changes. */
export function getInventoryAlerts(writes: InventoryStockWrite[]): InventoryAlert[] {
    return writes.flatMap(({ item, before, stockLevel, movement }) => {
        const alerts: InventoryAlert[] = []
        const quantity = stockLevel.measurement.$type === 'quantity' ? stockLevel.measurement.quantity : null
        const reserved = stockLevel.reservedQuantity ?? 0
        const isOrderable = isOrderableInventoryItem(item)

        if (isOrderable && movement.$type === 'counted' && movement.quantityBefore !== movement.quantityAfter) {
            alerts.push({
                title: `${item.name}: count didn't match`,
                detail: `Counted ${movement.quantityAfter} but the system had ${movement.quantityBefore}. Reason given: "${movement.reason ?? 'none'}". Counted by ${movement.createdBy.$type === 'staff' ? movement.createdBy.email : 'the system'}.`,
            })
        }

        const canGoShort = movement.$type === 'counted' || movement.$type === 'removed' || movement.$type === 'reserved'
        if (isOrderable && canGoShort && quantity !== null && quantity < reserved) {
            alerts.push({
                title: `${item.name}: not enough for upcoming parties`,
                detail: `Only ${quantity} on hand but ${reserved} reserved for upcoming parties. Some parties will be short unless more arrive.`,
            })
        }

        const isTracked = item.status === 'active' && stockLevel.stocked
        if (isTracked && !getIsInventoryRunningLow(item, before) && getIsInventoryRunningLow(item, stockLevel)) {
            alerts.push({
                title: `${item.name}: running low`,
                detail: isOrderable
                    ? `${Math.max((quantity ?? 0) - reserved, 0)} left for customers to order (${quantity} on hand, ${reserved} reserved). Time to reorder.`
                    : describeRunningLow(stockLevel),
            })
        }

        return alerts
    })
}

function describeRunningLow(stockLevel: InventoryStockLevel) {
    return stockLevel.measurement.$type === 'quantity'
        ? `${stockLevel.measurement.quantity} left. Time to reorder.`
        : `Stock level is ${stockLevel.measurement.level}. Time to reorder.`
}

/** Emails the studio's inventory owners. Never throws, since the stock change has already been saved. */
export async function sendInventoryAlerts(location: Studio, writes: InventoryStockWrite[]) {
    const alerts = getInventoryAlerts(writes)
    if (alerts.length === 0) return

    try {
        const [to, ...cc] = getInventoryOwnerEmails(location)
        const mailClient = await MailClient.getInstance()
        await mailClient.sendEmail(
            'inventoryAlert',
            to,
            { studio: capitalise(location), alerts },
            { cc, bccBookings: false, subject: `${capitalise(location)} inventory: ${alerts[0].title}` }
        )
    } catch (err) {
        logError(`error sending inventory alert for '${location}'`, err, { alerts })
    }
}
