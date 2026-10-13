import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ALL_CATEGORIES } from '../utils/inventory.constants'
import { useInventoryStore } from './inventory-store'

import type { ClientInventoryItem, ClientInventoryStockLevel, ClientInventoryUsageRule } from '../utils/inventory.types'

const item: ClientInventoryItem = {
    id: 'item-1',
    name: 'Party pies',
    category: 'party-food',
    status: 'active',
    $trackingMode: 'quantity',
    baseUnit: 'each',
    runningLowThreshold: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
}

const stock: ClientInventoryStockLevel = {
    id: 'stock-1',
    itemId: 'item-1',
    location: 'balwyn',
    stocked: true,
    measurement: { $type: 'quantity', quantity: 4 },
    updatedAt: new Date(),
}

const usageRule: ClientInventoryUsageRule = {
    id: 'rule-1',
    $type: 'party-base',
    inventoryKey: 'party-base:partyPies',
    status: 'active',
    quantity: { $operation: 'fixed', quantity: 1 },
    createdAt: new Date(),
    updatedAt: new Date(),
}

function resetInventoryStore() {
    useInventoryStore.setState({
        selectedLocation: undefined,
        shoppingListStartDate: '2026-05-01',
        shoppingListEndDate: '2026-05-08',
        categoryFilter: ALL_CATEGORIES,
        stockStatusFilter: 'all',
        search: '',
        isCreateDialogOpen: false,
        isCreateUsageRuleDialogOpen: false,
        editingItem: null,
        editingUsageRule: null,
        stockAction: null,
        isReceiveDeliveryOpen: false,
        historyItem: null,
        showHiddenItems: false,
    })
}

describe('inventory store', () => {
    beforeEach(() => {
        vi.useRealTimers()
        resetInventoryStore()
    })

    it('updates filters and shopping-list dates', () => {
        useInventoryStore.getState().setSelectedLocation('balwyn')
        useInventoryStore.getState().setShoppingListDateRange({ startDate: '2026-06-01', endDate: '2026-06-07' })
        useInventoryStore.getState().setCategoryFilter('party-food')
        useInventoryStore.getState().setStockStatusFilter('running-low')
        useInventoryStore.getState().setSearch('pies')

        expect(useInventoryStore.getState()).toMatchObject({
            selectedLocation: 'balwyn',
            shoppingListStartDate: '2026-06-01',
            shoppingListEndDate: '2026-06-07',
            categoryFilter: 'party-food',
            stockStatusFilter: 'running-low',
            search: 'pies',
        })
    })

    it('opens and closes dialogs', () => {
        useInventoryStore.getState().setCreateDialogOpen(true)
        useInventoryStore.getState().setCreateUsageRuleDialogOpen(true)
        useInventoryStore.getState().openEditDialog(item)
        useInventoryStore.getState().openEditUsageRuleDialog(usageRule)
        useInventoryStore.getState().openStockActionDialog('count', item, stock)
        useInventoryStore.getState().setReceiveDeliveryOpen(true)
        useInventoryStore.getState().openHistoryDialog(item)

        expect(useInventoryStore.getState().isCreateDialogOpen).toBe(true)
        expect(useInventoryStore.getState().isCreateUsageRuleDialogOpen).toBe(true)
        expect(useInventoryStore.getState().editingItem).toBe(item)
        expect(useInventoryStore.getState().editingUsageRule).toBe(usageRule)
        expect(useInventoryStore.getState().stockAction).toEqual({ $type: 'count', item, stock })
        expect(useInventoryStore.getState().isReceiveDeliveryOpen).toBe(true)
        expect(useInventoryStore.getState().historyItem).toBe(item)

        useInventoryStore.getState().closeEditDialog()
        useInventoryStore.getState().closeEditUsageRuleDialog()
        useInventoryStore.getState().closeStockActionDialog()
        useInventoryStore.getState().setReceiveDeliveryOpen(false)
        useInventoryStore.getState().closeHistoryDialog()

        expect(useInventoryStore.getState().editingItem).toBeNull()
        expect(useInventoryStore.getState().editingUsageRule).toBeNull()
        expect(useInventoryStore.getState().stockAction).toBeNull()
        expect(useInventoryStore.getState().isReceiveDeliveryOpen).toBe(false)
        expect(useInventoryStore.getState().historyItem).toBeNull()
    })

    it('toggles hidden item visibility from boolean or updater', () => {
        useInventoryStore.getState().setShowHiddenItems(true)
        expect(useInventoryStore.getState().showHiddenItems).toBe(true)

        useInventoryStore.getState().setShowHiddenItems((current) => !current)
        expect(useInventoryStore.getState().showHiddenItems).toBe(false)
    })
})
