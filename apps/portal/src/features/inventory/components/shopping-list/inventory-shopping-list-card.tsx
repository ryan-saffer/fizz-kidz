import { format } from 'date-fns'
import { CalendarIcon, Loader2, ShoppingCart, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import type {
    InventoryShoppingListLine,
    InventoryShoppingListStudioReport,
    InventoryShoppingListWarning,
    InventoryUnit,
} from '@fizz-kidz/core'

import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Calendar } from '@shared/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'
import { getOrgName } from '@shared/lib/studio-utils'
import { cn } from '@shared/lib/tailwind'

import { useInventoryShoppingList } from '../../hooks/use-inventory-shopping-list'
import { useInventoryStore } from '../../state/inventory-store'
import { primaryButtonClass } from '../../utils/inventory.constants'
import { formatCategory, formatQuantityUnit } from '../../utils/inventory.utils'

import type { DateRange } from 'react-day-picker'

const formatQuantity = (value: number) =>
    new Intl.NumberFormat('en-AU', {
        maximumFractionDigits: 3,
        minimumFractionDigits: 0,
    }).format(value)

export function InventoryShoppingListCard() {
    const { canGenerate, canViewShoppingList, endDate, location, shoppingListQuery, startDate } =
        useInventoryShoppingList()
    const setDateRange = useInventoryStore((state) => state.setShoppingListDateRange)

    if (!canViewShoppingList) {
        return null
    }

    const report = shoppingListQuery.data
    const reportsWithActivity = report?.studioReports.filter(
        (studioReport) =>
            studioReport.bookingCount > 0 || studioReport.lines.length > 0 || studioReport.warnings.length > 0
    )

    return (
        <Card className="rounded-3xl border-white bg-white/90 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
            <CardHeader className="gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <ShoppingCart className="h-5 w-5 text-[#007f93]" /> Shopping list
                        </CardTitle>
                        <CardDescription>
                            Generate purchase quantities from upcoming party bookings and inventory usage rules.
                        </CardDescription>
                    </div>
                    {report ? (
                        <Badge className="w-fit rounded-full bg-cyan-50 px-3 py-1 text-cyan-800 hover:bg-cyan-50">
                            {report.bookingCount} {report.bookingCount === 1 ? 'booking' : 'bookings'}
                        </Badge>
                    ) : null}
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="grid gap-2 sm:max-w-md sm:grid-cols-[1fr,auto]">
                        <DateRangePicker startDate={startDate} endDate={endDate} onChange={setDateRange} />
                        <Button
                            type="button"
                            className={primaryButtonClass}
                            disabled={!canGenerate || shoppingListQuery.isFetching}
                            onClick={() => void shoppingListQuery.refetch()}
                        >
                            {shoppingListQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Generate
                        </Button>
                    </div>
                    <p className="m-0 text-sm text-slate-500">
                        {location === 'master' ? 'Grouped by all studios.' : `Showing ${getOrgName(location)}.`}
                    </p>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-5">
                    {!canGenerate ? (
                        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                            <TriangleAlert className="h-4 w-4" />
                            <AlertTitle>Choose a valid date range</AlertTitle>
                            <AlertDescription>The end date must be on or after the start date.</AlertDescription>
                        </Alert>
                    ) : null}
                    {shoppingListQuery.isError ? (
                        <Alert variant="destructive">
                            <TriangleAlert className="h-4 w-4" />
                            <AlertTitle>Unable to generate shopping list</AlertTitle>
                            <AlertDescription>{shoppingListQuery.error.message}</AlertDescription>
                        </Alert>
                    ) : null}
                    {report && report.warnings.length > 0 ? <ShoppingListWarnings warnings={report.warnings} /> : null}
                    {shoppingListQuery.isPending ? (
                        <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 py-14 text-sm text-slate-500">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading shopping list
                        </div>
                    ) : null}
                    {report && !shoppingListQuery.isPending ? (
                        reportsWithActivity && reportsWithActivity.length > 0 ? (
                            reportsWithActivity.map((studioReport) => (
                                <StudioShoppingListReport key={studioReport.location} report={studioReport} />
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                                <p className="m-0 text-sm font-semibold text-slate-700">No stock required.</p>
                                <p className="m-1 text-sm text-slate-500">
                                    No matching studio party bookings or usage rules were found for this period.
                                </p>
                            </div>
                        )
                    ) : null}
                </div>
            </CardContent>
        </Card>
    )
}

function DateRangePicker({
    startDate,
    endDate,
    onChange,
}: {
    startDate: string
    endDate: string
    onChange: (dateRange: { startDate: string; endDate: string }) => void
}) {
    const [open, setOpen] = useState(false)
    const selectedRange: DateRange | undefined = startDate
        ? {
              from: new Date(`${startDate}T00:00:00`),
              to: endDate ? new Date(`${endDate}T00:00:00`) : undefined,
          }
        : undefined
    const buttonLabel = getDateRangeLabel(selectedRange)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        'w-full justify-start text-left font-normal',
                        !selectedRange?.from && 'text-slate-500'
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {buttonLabel}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    weekStartsOn={1}
                    defaultMonth={selectedRange?.from}
                    selected={selectedRange}
                    onSelect={(range) => {
                        onChange({
                            startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
                            endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
                        })
                    }}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}

function StudioShoppingListReport({ report }: { report: InventoryShoppingListStudioReport }) {
    const totalToBuy = report.lines.reduce((total, line) => total + (line.suggestedPurchaseQuantity ?? 0), 0)

    return (
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="m-0 text-lg font-black text-slate-950">{getOrgName(report.location)}</h3>
                    <p className="m-0 text-sm text-slate-600">
                        {report.bookingCount} {report.bookingCount === 1 ? 'booking' : 'bookings'} in this range
                    </p>
                </div>
                <Badge className="w-fit rounded-full bg-[#AC4390]/10 px-3 py-1 text-[#AC4390] hover:bg-[#AC4390]/10">
                    {formatQuantity(totalToBuy)} total units to buy
                </Badge>
            </div>
            {report.lines.length > 0 ? <ShoppingListTable lines={report.lines} /> : null}
            {report.lines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                    No quantity-tracked items were calculated for this studio.
                </div>
            ) : null}
        </section>
    )
}

function ShoppingListTable({ lines }: { lines: InventoryShoppingListLine[] }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Needed</TableHead>
                    <TableHead>In stock</TableHead>
                    <TableHead>Buy</TableHead>
                    <TableHead>Source</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {lines.map((line) => (
                    <TableRow key={`${line.location}-${line.itemId}`}>
                        <TableCell>
                            <div className="flex flex-col gap-1">
                                <span className="font-semibold text-slate-950">{line.itemName}</span>
                                <span className="text-xs text-slate-500">{formatCategory(line.category)}</span>
                                {!line.stocked ? (
                                    <Badge className="w-fit rounded-full bg-sky-50 px-2.5 py-0.5 text-xs text-sky-700 hover:bg-sky-50">
                                        Unused here
                                    </Badge>
                                ) : null}
                            </div>
                        </TableCell>
                        <TableCell>{formatLineQuantity(line.requiredQuantity, line.baseUnit)}</TableCell>
                        <TableCell>{formatStockQuantity(line.quantityOnHand, line.baseUnit)}</TableCell>
                        <TableCell>
                            {line.suggestedPurchaseQuantity === null ? (
                                <Badge className="w-fit rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                                    Count first
                                </Badge>
                            ) : line.suggestedPurchaseQuantity > 0 ? (
                                <span className="font-black text-[#AC4390]">
                                    {formatLineQuantity(line.suggestedPurchaseQuantity, line.baseUnit)}
                                </span>
                            ) : (
                                <span className="font-semibold text-emerald-700">Nothing</span>
                            )}
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col gap-1 text-xs text-slate-500">
                                {line.sourceBreakdown.map((source) => (
                                    <span key={source.ruleId}>
                                        {source.label}: {formatQuantity(source.requiredQuantity)} across{' '}
                                        {source.bookingCount} {source.bookingCount === 1 ? 'booking' : 'bookings'}
                                    </span>
                                ))}
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function ShoppingListWarnings({ warnings }: { warnings: InventoryShoppingListWarning[] }) {
    return (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Review before ordering</AlertTitle>
            <AlertDescription>
                <ul className="m-0 list-disc space-y-1 pl-4">
                    {warnings.slice(0, 12).map((warning, index) => (
                        <li key={`${warning.$type}-${index}`}>{getWarningMessage(warning)}</li>
                    ))}
                </ul>
                {warnings.length > 12 ? (
                    <p className="m-0 mt-2 text-xs">Showing 12 of {warnings.length} warnings.</p>
                ) : null}
            </AlertDescription>
        </Alert>
    )
}

function getDateRangeLabel(range: DateRange | undefined) {
    if (range?.from && range.to) {
        return `${format(range.from, 'PPP')} - ${format(range.to, 'PPP')}`
    }

    if (range?.from) {
        return `${format(range.from, 'PPP')} - Pick end date`
    }

    return 'Pick date range'
}

function formatLineQuantity(quantity: number, unit: InventoryUnit) {
    return `${formatQuantity(quantity)} ${formatQuantityUnit(unit, quantity)}`
}

function formatStockQuantity(quantity: number | null, unit: InventoryUnit) {
    return quantity === null ? 'Unknown' : formatLineQuantity(quantity, unit)
}

function getWarningMessage(warning: InventoryShoppingListWarning) {
    switch (warning.$type) {
        case 'no-active-rules':
            return warning.message
        case 'invalid-child-count':
            if (!warning.value?.trim()) {
                return `${getOrgName(warning.location)} booking ${warning.bookingLabel} has not completed party form.`
            }

            return `${getOrgName(warning.location)} booking ${warning.bookingLabel} has invalid child count '${warning.value}'.`
        case 'missing-inventory-item':
            return `${getOrgName(warning.location)} needs ${formatQuantity(warning.requiredQuantity)} for '${warning.inventoryKey}', but no active inventory item matches that key.`
        case 'duplicate-inventory-items':
            return `${getOrgName(warning.location)} has multiple active items for '${warning.inventoryKey}': ${warning.itemNames.join(', ')}.`
        case 'qualitative-item-required':
            return `${getOrgName(warning.location)} needs '${warning.itemName}', but it is qualitative. Check current level before ordering.`
        case 'missing-stock-level':
            return `${getOrgName(warning.location)} needs '${warning.itemName}', but no stock record exists for that studio.`
        case 'unused-at-location':
            return `${getOrgName(warning.location)} needs '${warning.itemName}', but it is marked unused at that studio.`
        case 'unknown-stock-quantity':
            return `${getOrgName(warning.location)} needs '${warning.itemName}', but the current stock count is unknown.`
    }
}
