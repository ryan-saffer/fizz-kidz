import { create } from 'zustand'

import type { InventoryCategory, Studio } from '@fizz-kidz/core'

import { ALL_CATEGORIES } from '../utils/inventory.constants'

import type {
    ClientInventoryItem,
    ClientInventoryStockLevel,
    ClientInventoryUsageRule,
    StockAction,
    StockActionType,
    StockStatusFilter,
} from '../utils/inventory.types'

type State = {
    selectedLocation: Studio | undefined
    shoppingListStartDate: string
    shoppingListEndDate: string
    categoryFilter: InventoryCategory | typeof ALL_CATEGORIES
    stockStatusFilter: StockStatusFilter
    search: string
    isCreateDialogOpen: boolean
    isCreateUsageRuleDialogOpen: boolean
    editingItem: ClientInventoryItem | null
    editingUsageRule: ClientInventoryUsageRule | null
    stockAction: StockAction | null
    isReceiveDeliveryOpen: boolean
    isCountAllOpen: boolean
    historyItem: ClientInventoryItem | null
    showHiddenItems: boolean
}

type Actions = {
    setSelectedLocation: (location: Studio | undefined) => void
    setShoppingListDateRange: (dateRange: { startDate: string; endDate: string }) => void
    setCategoryFilter: (category: InventoryCategory | typeof ALL_CATEGORIES) => void
    setStockStatusFilter: (filter: StockStatusFilter) => void
    setSearch: (search: string) => void
    setCreateDialogOpen: (open: boolean) => void
    setCreateUsageRuleDialogOpen: (open: boolean) => void
    openEditDialog: (item: ClientInventoryItem) => void
    closeEditDialog: () => void
    openEditUsageRuleDialog: (usageRule: ClientInventoryUsageRule) => void
    closeEditUsageRuleDialog: () => void
    openStockActionDialog: (
        $type: StockActionType,
        item: ClientInventoryItem,
        stock?: ClientInventoryStockLevel
    ) => void
    closeStockActionDialog: () => void
    setReceiveDeliveryOpen: (open: boolean) => void
    setCountAllOpen: (open: boolean) => void
    openHistoryDialog: (item: ClientInventoryItem) => void
    closeHistoryDialog: () => void
    setShowHiddenItems: (value: boolean | ((current: boolean) => boolean)) => void
}

type InventoryStore = State & Actions

export const useInventoryStore = create<InventoryStore>((set) => ({
    selectedLocation: undefined,
    shoppingListStartDate: getTodayInputValue(),
    shoppingListEndDate: getNextWeekInputValue(),
    categoryFilter: ALL_CATEGORIES,
    stockStatusFilter: 'all',
    search: '',
    isCreateDialogOpen: false,
    isCreateUsageRuleDialogOpen: false,
    editingItem: null,
    editingUsageRule: null,
    stockAction: null,
    isReceiveDeliveryOpen: false,
    isCountAllOpen: false,
    historyItem: null,
    showHiddenItems: false,
    setSelectedLocation: (selectedLocation) => set({ selectedLocation }),
    setShoppingListDateRange: ({ startDate, endDate }) =>
        set({ shoppingListStartDate: startDate, shoppingListEndDate: endDate }),
    setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
    setStockStatusFilter: (stockStatusFilter) => set({ stockStatusFilter }),
    setSearch: (search) => set({ search }),
    setCreateDialogOpen: (isCreateDialogOpen) => set({ isCreateDialogOpen }),
    setCreateUsageRuleDialogOpen: (isCreateUsageRuleDialogOpen) => set({ isCreateUsageRuleDialogOpen }),
    openEditDialog: (editingItem) => set({ editingItem }),
    closeEditDialog: () => set({ editingItem: null }),
    openEditUsageRuleDialog: (editingUsageRule) => set({ editingUsageRule }),
    closeEditUsageRuleDialog: () => set({ editingUsageRule: null }),
    openStockActionDialog: ($type, item, stock) => set({ stockAction: { $type, item, stock } }),
    closeStockActionDialog: () => set({ stockAction: null }),
    setReceiveDeliveryOpen: (isReceiveDeliveryOpen) => set({ isReceiveDeliveryOpen }),
    setCountAllOpen: (isCountAllOpen) => set({ isCountAllOpen }),
    openHistoryDialog: (historyItem) => set({ historyItem }),
    closeHistoryDialog: () => set({ historyItem: null }),
    setShowHiddenItems: (value) =>
        set((state) => ({
            showHiddenItems: typeof value === 'function' ? value(state.showHiddenItems) : value,
        })),
}))

function getTodayInputValue() {
    return toDateInputValue(new Date())
}

function getNextWeekInputValue() {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return toDateInputValue(date)
}

function toDateInputValue(date: Date) {
    return date.toISOString().slice(0, 10)
}
