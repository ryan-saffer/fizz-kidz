import { CircleQuestionMark, EyeOff, History, Loader2, MinusCircle, MoreHorizontal, Pencil } from 'lucide-react'

import { getInventoryAvailableQuantity, isOrderableInventoryItem } from '@fizz-kidz/core'
import type { InventoryUnit, Studio } from '@fizz-kidz/core'

import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'
import { getOrgName } from '@shared/lib/studio-utils'
import { cn } from '@shared/lib/tailwind'

import { secondaryButtonClass } from '../../utils/inventory.constants'
import {
    formatCategory,
    formatQualitativeLevel,
    formatQuantityUnit,
    getIsRunningLow,
} from '../../utils/inventory.utils'
import { InventorySectionHeading } from '../shared/inventory-section-heading'

import type { ClientInventoryItem, ClientInventoryStockLevel, StockActionType } from '../../utils/inventory.types'

export function InventoryItemsTable({
    title,
    description,
    emptyTitle,
    emptyDescription,
    isLoading,
    items,
    location,
    canManageItems,
    canUpdateStock,
    isStockChangePending,
    isSetStockedPending,
    onEditItem,
    onMarkQuantityUnknown,
    onOpenStockAction,
    onOpenHistory,
    onSetStocked,
    stockByItemId,
}: {
    title: string
    description: string
    emptyTitle: string
    emptyDescription: string
    isLoading: boolean
    items: ClientInventoryItem[]
    location: Studio
    canManageItems: boolean
    canUpdateStock: boolean
    isStockChangePending: boolean
    isSetStockedPending: boolean
    onEditItem: (item: ClientInventoryItem) => void
    onMarkQuantityUnknown: (item: ClientInventoryItem) => void
    onOpenStockAction: ($type: StockActionType, item: ClientInventoryItem, stock?: ClientInventoryStockLevel) => void
    onOpenHistory: (item: ClientInventoryItem) => void
    onSetStocked: (item: ClientInventoryItem, stocked: boolean) => void
    stockByItemId: Map<string, ClientInventoryStockLevel>
}) {
    if (isLoading) {
        return (
            <section className="flex flex-col gap-3">
                <InventorySectionHeading title={title} description={description} />
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading inventory
                </div>
            </section>
        )
    }

    if (items.length === 0) {
        return (
            <section className="flex flex-col gap-3">
                <InventorySectionHeading title={title} description={description} />
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                    <p className="m-0 text-sm font-semibold text-slate-700">{emptyTitle}</p>
                    <p className="m-1 text-sm text-slate-500">{emptyDescription}</p>
                </div>
            </section>
        )
    }

    return (
        <section className="flex flex-col gap-3">
            <InventorySectionHeading title={title} description={description} />
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>{getOrgName(location)} stock</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => {
                        const stock = stockByItemId.get(item.id)
                        const isStocked = stock?.stocked ?? false
                        const isArchived = item.status === 'archived'
                        const isRunningLow = item.status === 'active' && isStocked && getIsRunningLow(item, stock)
                        const hasUnknownQuantity =
                            stock?.measurement.$type === 'quantity' && stock.measurement.quantity === null
                        const isOrderable = isOrderableInventoryItem(item)
                        const canChangeStock = canUpdateStock && !isArchived && isStocked

                        return (
                            <TableRow key={item.id} className={isArchived || !isStocked ? 'bg-slate-50/70' : undefined}>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-slate-950">{item.name}</span>
                                            {isArchived ? (
                                                <Badge className="w-fit rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100">
                                                    Archived
                                                </Badge>
                                            ) : null}
                                            {!isStocked ? (
                                                <Badge className="w-fit rounded-full bg-sky-50 px-2.5 py-0.5 text-xs text-sky-700 hover:bg-sky-50">
                                                    Unused here
                                                </Badge>
                                            ) : null}
                                            {isRunningLow ? (
                                                <Badge className="w-fit rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50">
                                                    Running low
                                                </Badge>
                                            ) : null}
                                        </div>
                                        {item.notes ? (
                                            <span className="text-xs text-slate-500">{item.notes}</span>
                                        ) : null}
                                    </div>
                                </TableCell>
                                <TableCell>{formatCategory(item.category)}</TableCell>
                                <TableCell>{formatStockLevel(stock, item.baseUnit, isOrderable)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {canChangeStock && item.$trackingMode === 'quantity' ? (
                                            <>
                                                {!isOrderable && !hasUnknownQuantity ? (
                                                    <ActionButton
                                                        onClick={() => onOpenStockAction('receive', item, stock)}
                                                    >
                                                        Receive
                                                    </ActionButton>
                                                ) : null}
                                                <ActionButton onClick={() => onOpenStockAction('count', item, stock)}>
                                                    Count
                                                </ActionButton>
                                            </>
                                        ) : null}
                                        {canChangeStock && item.$trackingMode === 'qualitative' ? (
                                            <ActionButton onClick={() => onOpenStockAction('level', item, stock)}>
                                                Update level
                                            </ActionButton>
                                        ) : null}
                                        {canUpdateStock && !isArchived && !isStocked ? (
                                            <ActionButton
                                                disabled={isSetStockedPending}
                                                onClick={() => onSetStocked(item, true)}
                                            >
                                                Track here
                                            </ActionButton>
                                        ) : null}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className={secondaryButtonClass}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">More actions</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="twp">
                                                <DropdownMenuItem onClick={() => onOpenHistory(item)}>
                                                    <History className="mr-2 h-4 w-4" /> Stock history
                                                </DropdownMenuItem>
                                                {canChangeStock &&
                                                item.$trackingMode === 'quantity' &&
                                                !hasUnknownQuantity ? (
                                                    <DropdownMenuItem
                                                        onClick={() => onOpenStockAction('remove', item, stock)}
                                                    >
                                                        <MinusCircle className="mr-2 h-4 w-4" /> Remove (thrown out)
                                                    </DropdownMenuItem>
                                                ) : null}
                                                {canChangeStock &&
                                                item.$trackingMode === 'quantity' &&
                                                !isOrderable &&
                                                !hasUnknownQuantity ? (
                                                    <DropdownMenuItem
                                                        disabled={isStockChangePending}
                                                        onClick={() => onMarkQuantityUnknown(item)}
                                                    >
                                                        <CircleQuestionMark className="mr-2 h-4 w-4" /> Mark count
                                                        unknown
                                                    </DropdownMenuItem>
                                                ) : null}
                                                {canChangeStock ? (
                                                    <DropdownMenuItem
                                                        disabled={isSetStockedPending}
                                                        onClick={() => onSetStocked(item, false)}
                                                    >
                                                        <EyeOff className="mr-2 h-4 w-4" /> Mark unused here
                                                    </DropdownMenuItem>
                                                ) : null}
                                                {canManageItems ? (
                                                    <DropdownMenuItem onClick={() => onEditItem(item)}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit item
                                                    </DropdownMenuItem>
                                                ) : null}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </section>
    )
}

function ActionButton({ children, disabled, onClick }: { children: string; disabled?: boolean; onClick: () => void }) {
    return (
        <Button variant="outline" size="sm" className={secondaryButtonClass} disabled={disabled} onClick={onClick}>
            {children}
        </Button>
    )
}

function formatStockLevel(
    stock: ClientInventoryStockLevel | undefined,
    unit: InventoryUnit | undefined,
    isOrderable: boolean
) {
    if (!stock) {
        return <span className="text-sm text-slate-500">No studio record</span>
    }

    if (!stock.stocked) {
        return <span className="text-sm font-semibold text-slate-500">Unused here</span>
    }

    if (stock.measurement.$type === 'quantity') {
        if (stock.measurement.quantity === null) {
            return (
                <Badge className="w-fit rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                    Unknown
                </Badge>
            )
        }

        if (isOrderable) {
            const available = getInventoryAvailableQuantity(stock) ?? 0
            return (
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-950">{stock.measurement.quantity} here</span>
                    <span className={cn('text-xs', available < 0 ? 'font-bold text-red-700' : 'text-slate-500')}>
                        {stock.reservedQuantity ?? 0} reserved · {available} available to order
                    </span>
                </div>
            )
        }

        return (
            <span className="font-semibold text-slate-950">
                {stock.measurement.quantity} {formatQuantityUnit(unit, stock.measurement.quantity)}
            </span>
        )
    }

    const level = stock.measurement.level
    return (
        <Badge
            className={cn(
                'w-fit rounded-full px-3 py-1 capitalize',
                level === 'high' && 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
                level === 'medium' && 'bg-sky-50 text-sky-700 hover:bg-sky-50',
                level === 'low' && 'bg-amber-50 text-amber-700 hover:bg-amber-50',
                level === 'out' && 'bg-red-50 text-red-700 hover:bg-red-50',
                level === 'unknown' && 'bg-slate-100 text-slate-600 hover:bg-slate-100'
            )}
        >
            {formatQualitativeLevel(level)}
        </Badge>
    )
}
