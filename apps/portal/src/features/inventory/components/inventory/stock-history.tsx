import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { DateTime } from 'luxon'

import type { InventoryStockMovement, Studio } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'

import { formatQualitativeLevel } from '../../utils/inventory.utils'

import type { ClientInventoryItem } from '../../utils/inventory.types'

type ClientMovement = InventoryStockMovement extends infer M
    ? M extends unknown
        ? Omit<M, 'createdAt'> & { createdAt: string | Date }
        : never
    : never

export function StockHistory({ item, location }: { item: ClientInventoryItem; location: Studio }) {
    const trpc = useTRPC()
    const movementsQuery = useQuery(
        trpc.inventory.listMovements.queryOptions({ location, itemId: item.id, limit: 100 })
    )

    if (movementsQuery.isPending) {
        return (
            <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history
            </div>
        )
    }

    const movements = (movementsQuery.data ?? []) as ClientMovement[]
    if (movements.length === 0) {
        return <p className="m-0 text-sm text-slate-500">No stock changes yet.</p>
    }

    return (
        <ol className="m-0 flex max-h-[60vh] list-none flex-col divide-y divide-slate-100 overflow-y-auto p-0">
            {movements.map((movement) => (
                <li key={movement.id} className="flex flex-col gap-0.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-4">
                        <span className="text-sm font-semibold text-slate-900">{describeMovement(movement)}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                            {DateTime.fromJSDate(new Date(movement.createdAt)).toFormat('d LLL yyyy, h:mma')}
                        </span>
                    </div>
                    <span className="text-xs text-slate-500">
                        {describeChange(movement)} ·{' '}
                        {movement.createdBy.$type === 'staff' ? movement.createdBy.email : 'Automatic'}
                    </span>
                    {movement.reason ? <span className="text-xs text-slate-700">“{movement.reason}”</span> : null}
                </li>
            ))}
        </ol>
    )
}

function describeMovement(movement: ClientMovement) {
    switch (movement.$type) {
        case 'received':
            return `Received ${movement.quantity}`
        case 'counted':
            return movement.quantityAfter === null ? 'Count marked unknown' : `Counted ${movement.quantityAfter}`
        case 'removed':
            return `Removed ${movement.quantity}`
        case 'level-updated':
            return `Level set to ${formatQualitativeLevel(movement.levelAfter)}`
        case 'reserved':
            return `Reserved ${movement.quantity} for a party`
        case 'released':
            return `Released ${movement.quantity} back to stock`
        case 'used':
            return `Used ${movement.quantity} at a party`
    }
}

function describeChange(movement: ClientMovement) {
    switch (movement.$type) {
        case 'received':
        case 'removed':
        case 'used':
            return `On hand ${movement.quantityBefore} → ${movement.quantityAfter}`
        case 'counted':
            return `On hand ${movement.quantityBefore ?? 'unknown'} → ${movement.quantityAfter ?? 'unknown'}`
        case 'level-updated':
            return `${formatQualitativeLevel(movement.levelBefore)} → ${formatQualitativeLevel(movement.levelAfter)}`
        case 'reserved':
        case 'released':
            return `Reserved ${movement.reservedBefore} → ${movement.reservedAfter}`
    }
}
