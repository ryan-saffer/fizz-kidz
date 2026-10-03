import { ClipboardList, PackageCheck, PackagePlus, Search, X } from 'lucide-react'
import { startTransition } from 'react'

import { INVENTORY_CATEGORIES } from '@fizz-kidz/core'
import type { InventoryCategory, Studio } from '@fizz-kidz/core'

import { useOrg } from '@session/use-org'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@shared/components/ui/dialog'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { getOrgName } from '@shared/lib/studio-utils'
import { cn } from '@shared/lib/tailwind'

import { useInventoryActions } from '../../hooks/use-inventory-actions'
import { useInventoryData } from '../../hooks/use-inventory-data'
import { useInventoryStore } from '../../state/inventory-store'
import { ALL_CATEGORIES, primaryButtonClass, secondaryButtonClass } from '../../utils/inventory.constants'
import { formatCategory, pluraliseItem } from '../../utils/inventory.utils'
import { InventoryItemForm } from './inventory-item-form'
import { InventoryItemsTable } from './inventory-items-table'
import { StockStatusFilters } from './stock-status-filters'

import type { ReactNode } from 'react'

export function InventoryCatalogueCard() {
    const data = useInventoryData()
    const actions = useInventoryActions()
    const { hasPermission } = useOrg()
    const canManageItems = hasPermission('inventory:manage-items')
    const canUpdateStock = hasPermission('inventory:update-stock')
    const categoryFilter = useInventoryStore((state) => state.categoryFilter)
    const stockStatusFilter = useInventoryStore((state) => state.stockStatusFilter)
    const search = useInventoryStore((state) => state.search)
    const isCreateDialogOpen = useInventoryStore((state) => state.isCreateDialogOpen)
    const showHiddenItems = useInventoryStore((state) => state.showHiddenItems)
    const setCategoryFilter = useInventoryStore((state) => state.setCategoryFilter)
    const setStockStatusFilter = useInventoryStore((state) => state.setStockStatusFilter)
    const setSearch = useInventoryStore((state) => state.setSearch)
    const setSelectedLocation = useInventoryStore((state) => state.setSelectedLocation)
    const setCreateDialogOpen = useInventoryStore((state) => state.setCreateDialogOpen)
    const openEditDialog = useInventoryStore((state) => state.openEditDialog)
    const openStockActionDialog = useInventoryStore((state) => state.openStockActionDialog)
    const openHistoryDialog = useInventoryStore((state) => state.openHistoryDialog)
    const setReceiveDeliveryOpen = useInventoryStore((state) => state.setReceiveDeliveryOpen)
    const setCountAllOpen = useInventoryStore((state) => state.setCountAllOpen)
    const setShowHiddenItems = useInventoryStore((state) => state.setShowHiddenItems)

    return (
        <Card className="rounded-3xl border-white bg-white/90 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
            <CardHeader className="gap-4">
                <CatalogueHeading
                    location={data.location}
                    shownItemCount={data.shownItemCount}
                    canEdit={canManageItems}
                    createItemButton={
                        <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className={primaryButtonClass}>
                                    <PackagePlus className="mr-2 h-4 w-4" /> Create new item
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="twp max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Create inventory item</DialogTitle>
                                    <DialogDescription>
                                        Inventory only tracks food: party food, plus cakes and take-home bags customers
                                        order from studio stock. New items are created for every studio and can be
                                        marked unused where needed.
                                    </DialogDescription>
                                </DialogHeader>
                                <InventoryItemForm
                                    isPending={actions.isCreatingItem}
                                    submitLabel="Create item"
                                    onSubmit={actions.createItem}
                                />
                            </DialogContent>
                        </Dialog>
                    }
                />
                <CatalogueFilters
                    search={search}
                    categoryFilter={categoryFilter}
                    location={data.location}
                    availableLocations={data.availableLocations}
                    canChooseLocation={data.canChooseLocation}
                    onSearchChange={setSearch}
                    onCategoryFilterChange={setCategoryFilter}
                    onLocationChange={setSelectedLocation}
                />
                <StockStatusFilters
                    value={stockStatusFilter}
                    totalCount={data.activeTrackedCount}
                    runningLowCount={data.runningLowItemCount}
                    needsCountCount={data.needsCountItemCount}
                    notRunningLowCount={data.notRunningLowItemCount}
                    onChange={setStockStatusFilter}
                />
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-8">
                    {data.orderableItems.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {canUpdateStock ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button className={primaryButtonClass} onClick={() => setReceiveDeliveryOpen(true)}>
                                        <PackageCheck className="mr-2 h-4 w-4" /> Receive cake & bag delivery
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className={secondaryButtonClass}
                                        onClick={() => setCountAllOpen(true)}
                                    >
                                        <ClipboardList className="mr-2 h-4 w-4" /> Count cakes & bags
                                    </Button>
                                </div>
                            ) : null}
                            <InventoryItemsTable
                                title="Cakes & take-home bags"
                                description="Customers order these on the party form. Each order reserves stock until the party, so 'here' includes reserved stock and only what's available can be ordered."
                                emptyTitle="No cakes or take-home bags found."
                                emptyDescription="Nothing matches the current filters."
                                items={data.orderableItems}
                                isLoading={data.isLoading}
                                location={data.location}
                                canManageItems={canManageItems}
                                canUpdateStock={canUpdateStock}
                                isStockChangePending={actions.isStockChangePending}
                                isSetStockedPending={actions.isSetStockedPending}
                                onEditItem={openEditDialog}
                                onMarkQuantityUnknown={actions.markQuantityUnknown}
                                onOpenStockAction={openStockActionDialog}
                                onOpenHistory={openHistoryDialog}
                                onSetStocked={actions.setItemStocked}
                                stockByItemId={data.stockByItemId}
                            />
                        </div>
                    ) : null}
                    <InventoryItemsTable
                        title="Party food"
                        description="Party food this studio currently uses and tracks."
                        emptyTitle="No tracked inventory items found."
                        emptyDescription="Create an item or mark an unused item as tracked here."
                        items={data.supplyItems}
                        isLoading={data.isLoading}
                        location={data.location}
                        canManageItems={canManageItems}
                        canUpdateStock={canUpdateStock}
                        isStockChangePending={actions.isStockChangePending}
                        isSetStockedPending={actions.isSetStockedPending}
                        onEditItem={openEditDialog}
                        onMarkQuantityUnknown={actions.markQuantityUnknown}
                        onOpenStockAction={openStockActionDialog}
                        onOpenHistory={openHistoryDialog}
                        onSetStocked={actions.setItemStocked}
                        stockByItemId={data.stockByItemId}
                    />
                    {data.hiddenItems.length > 0 ? (
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-fit px-0 text-sm font-semibold text-slate-500 hover:bg-transparent hover:text-[#AC4390]"
                            onClick={() => setShowHiddenItems((current) => !current)}
                        >
                            {showHiddenItems
                                ? `Hide ${data.hiddenItems.length} hidden ${pluraliseItem(data.hiddenItems.length)}`
                                : `Show ${data.hiddenItems.length} hidden ${pluraliseItem(data.hiddenItems.length)}`}
                        </Button>
                    ) : null}
                    {showHiddenItems && data.hiddenItems.length > 0 ? (
                        <InventoryItemsTable
                            title="Hidden items"
                            description="Archived catalogue items and global items this studio does not currently use. This is not the same as being out of stock."
                            emptyTitle="No hidden items."
                            emptyDescription="Every matching item is active and currently tracked at this studio."
                            items={data.hiddenItems}
                            isLoading={data.isLoading}
                            location={data.location}
                            canManageItems={canManageItems}
                            canUpdateStock={canUpdateStock}
                            isStockChangePending={actions.isStockChangePending}
                            isSetStockedPending={actions.isSetStockedPending}
                            onEditItem={openEditDialog}
                            onMarkQuantityUnknown={actions.markQuantityUnknown}
                            onOpenStockAction={openStockActionDialog}
                            onOpenHistory={openHistoryDialog}
                            onSetStocked={actions.setItemStocked}
                            stockByItemId={data.stockByItemId}
                        />
                    ) : null}
                </div>
            </CardContent>
        </Card>
    )
}

function CatalogueHeading({
    location,
    shownItemCount,
    canEdit,
    createItemButton,
}: {
    location: Studio
    shownItemCount: number
    canEdit: boolean
    createItemButton: ReactNode
}) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <CardTitle className="text-2xl">Inventory catalogue</CardTitle>
                <CardDescription>
                    Viewing stock for {location ? getOrgName(location) : 'selected studio'}.
                </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Badge className="w-fit rounded-full bg-[#AC4390]/10 px-3 py-1 text-[#AC4390] hover:bg-[#AC4390]/10">
                    {shownItemCount} shown
                </Badge>
                {canEdit ? createItemButton : null}
            </div>
        </div>
    )
}

function CatalogueFilters({
    search,
    categoryFilter,
    location,
    availableLocations,
    canChooseLocation,
    onSearchChange,
    onCategoryFilterChange,
    onLocationChange,
}: {
    search: string
    categoryFilter: InventoryCategory | typeof ALL_CATEGORIES
    location: Studio
    availableLocations: Studio[]
    canChooseLocation: boolean
    onSearchChange: (value: string) => void
    onCategoryFilterChange: (value: InventoryCategory | typeof ALL_CATEGORIES) => void
    onLocationChange: (value: Studio) => void
}) {
    return (
        <div
            className={cn(
                'grid gap-3',
                canChooseLocation ? 'md:grid-cols-[1fr,220px,220px]' : 'md:grid-cols-[1fr,220px]'
            )}
        >
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search items"
                    className="pl-9 pr-11"
                />
                {search ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1.5 top-1/2 min-h-7 w-7 -translate-y-1/2 rounded-md text-slate-500 hover:text-slate-900"
                        onClick={() => onSearchChange('')}
                        aria-label="Clear inventory search"
                    >
                        <X className="size-4" />
                    </Button>
                ) : null}
            </div>
            <Select
                value={categoryFilter}
                onValueChange={(value) => onCategoryFilterChange(value as InventoryCategory | typeof ALL_CATEGORIES)}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                    {INVENTORY_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                            {formatCategory(category)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {canChooseLocation ? (
                <Select
                    value={location}
                    onValueChange={(value) => {
                        startTransition(() => onLocationChange(value as Studio))
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableLocations.map((studio) => (
                            <SelectItem key={studio} value={studio}>
                                {getOrgName(studio)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : null}
        </div>
    )
}
