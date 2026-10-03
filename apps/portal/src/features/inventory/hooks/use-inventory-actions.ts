import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useTRPC } from '@integrations/trpc'
import { useConfirm } from '@shared/components/dialogs/confirmation/use-confirmation-dialog'

import { useInventoryStore } from '../state/inventory-store'
import { useInventoryLocation } from './use-inventory-location'

import type {
    InventoryItemFormValues,
    StockActionFormValues,
    UsageRuleFormValues,
} from '../utils/inventory.form-schemas'
import type { ClientInventoryItem } from '../utils/inventory.types'

export function useInventoryActions() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    const confirm = useConfirm()
    const { location } = useInventoryLocation()
    const editingItem = useInventoryStore((state) => state.editingItem)
    const editingUsageRule = useInventoryStore((state) => state.editingUsageRule)
    const stockAction = useInventoryStore((state) => state.stockAction)
    const setCreateDialogOpen = useInventoryStore((state) => state.setCreateDialogOpen)
    const setCreateUsageRuleDialogOpen = useInventoryStore((state) => state.setCreateUsageRuleDialogOpen)
    const closeEditDialog = useInventoryStore((state) => state.closeEditDialog)
    const closeEditUsageRuleDialog = useInventoryStore((state) => state.closeEditUsageRuleDialog)
    const closeStockActionDialog = useInventoryStore((state) => state.closeStockActionDialog)
    const setReceiveDeliveryOpen = useInventoryStore((state) => state.setReceiveDeliveryOpen)
    const setCountAllOpen = useInventoryStore((state) => state.setCountAllOpen)
    const openEditDialog = useInventoryStore((state) => state.openEditDialog)
    const openEditUsageRuleDialog = useInventoryStore((state) => state.openEditUsageRuleDialog)

    const createItemMutation = useMutation(
        trpc.inventory.createItem.mutationOptions({
            onSuccess: async () => {
                toast.success('Inventory item created.')
                setCreateDialogOpen(false)
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listItems.queryKey() }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listStock.queryKey({ location }) }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.generateShoppingList.queryKey() }),
                ])
            },
            onError: () => toast.error('Unable to create inventory item.'),
        })
    )

    const updateItemMutation = useMutation(
        trpc.inventory.updateItem.mutationOptions({
            onSuccess: async () => {
                toast.success('Inventory item updated.')
                closeEditDialog()
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listItems.queryKey() }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.generateShoppingList.queryKey() }),
                ])
            },
            onError: () => toast.error('Unable to update inventory item.'),
        })
    )

    const onStockChanged = async () => {
        closeStockActionDialog()
        await queryClient.invalidateQueries({ queryKey: trpc.inventory.listStock.queryKey({ location }) })
        await queryClient.invalidateQueries({ queryKey: trpc.inventory.listMovements.queryKey() })
    }
    const stockMutationOptions = (successMessage: string) => ({
        onSuccess: async () => {
            toast.success(successMessage)
            await onStockChanged()
        },
        onError: (error: { message: string }) => toast.error(error.message || 'Unable to update stock.'),
    })

    const receiveStockMutation = useMutation(
        trpc.inventory.receiveStock.mutationOptions(stockMutationOptions('Stock received.'))
    )
    const countStockMutation = useMutation(
        trpc.inventory.countStock.mutationOptions(stockMutationOptions('Count saved.'))
    )
    const removeStockMutation = useMutation(
        trpc.inventory.removeStock.mutationOptions(stockMutationOptions('Stock removed.'))
    )
    const updateStockLevelMutation = useMutation(
        trpc.inventory.updateStockLevel.mutationOptions(stockMutationOptions('Stock level updated.'))
    )

    const deleteItemMutation = useMutation(
        trpc.inventory.deleteItem.mutationOptions({
            onSuccess: async () => {
                toast.success('Inventory item deleted.')
                closeEditDialog()
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listItems.queryKey() }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listStock.queryKey() }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.generateShoppingList.queryKey() }),
                ])
            },
            onError: () => toast.error('Unable to delete inventory item.'),
        })
    )

    const setStockedMutation = useMutation(
        trpc.inventory.setStocked.mutationOptions({
            onSuccess: async (_, input) => {
                toast.success(input.stocked ? 'Item is now tracked here.' : 'Item marked unused here.')
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listStock.queryKey({ location }) }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.generateShoppingList.queryKey() }),
                ])
            },
            onError: () => toast.error('Unable to update studio tracking.'),
        })
    )

    const createUsageRuleMutation = useMutation(
        trpc.inventory.createUsageRule.mutationOptions({
            onSuccess: async () => {
                toast.success('Usage rule created.')
                setCreateUsageRuleDialogOpen(false)
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listUsageRules.queryKey() }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.generateShoppingList.queryKey() }),
                ])
            },
            onError: (error) => toast.error(error.message || 'Unable to create usage rule.'),
        })
    )

    const updateUsageRuleMutation = useMutation(
        trpc.inventory.updateUsageRule.mutationOptions({
            onSuccess: async () => {
                toast.success('Usage rule updated.')
                closeEditUsageRuleDialog()
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listUsageRules.queryKey() }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.generateShoppingList.queryKey() }),
                ])
            },
            onError: (error) => toast.error(error.message || 'Unable to update usage rule.'),
        })
    )

    const deleteUsageRuleMutation = useMutation(
        trpc.inventory.deleteUsageRule.mutationOptions({
            onSuccess: async () => {
                toast.success('Usage rule deleted.')
                closeEditUsageRuleDialog()
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.listUsageRules.queryKey() }),
                    queryClient.invalidateQueries({ queryKey: trpc.inventory.generateShoppingList.queryKey() }),
                ])
            },
            onError: () => toast.error('Unable to delete usage rule.'),
        })
    )

    const createItem = async (values: InventoryItemFormValues) => {
        const common = {
            name: values.name,
            category: values.category,
            status: values.status,
            notes: values.notes || undefined,
        }

        if (values.$trackingMode === 'quantity') {
            await createItemMutation.mutateAsync({
                ...common,
                $trackingMode: 'quantity',
                baseUnit: values.baseUnit,
                runningLowThreshold: values.runningLowThreshold,
                squareCatalogObjectId: values.squareCatalogObjectId ?? undefined,
            })
            return
        }

        await createItemMutation.mutateAsync({
            ...common,
            $trackingMode: 'qualitative',
            baseUnit: values.baseUnit,
        })
    }

    const updateItem = async (values: InventoryItemFormValues) => {
        if (!editingItem) return

        const common = {
            name: values.name,
            category: values.category,
            status: values.status,
            notes: values.notes || undefined,
        }

        if (values.$trackingMode === 'quantity') {
            await updateItemMutation.mutateAsync({
                itemId: editingItem.id,
                item: {
                    ...common,
                    $trackingMode: 'quantity',
                    baseUnit: values.baseUnit,
                    runningLowThreshold: values.runningLowThreshold,
                    squareCatalogObjectId: values.squareCatalogObjectId,
                },
            })
            return
        }

        await updateItemMutation.mutateAsync({
            itemId: editingItem.id,
            item: {
                ...common,
                $trackingMode: 'qualitative',
                baseUnit: values.baseUnit,
            },
        })
    }

    const deleteItem = async () => {
        if (!editingItem) return

        const itemToDelete = editingItem
        closeEditDialog()

        const confirmed = await confirm({
            title: `Delete ${itemToDelete.name} everywhere?`,
            description:
                'This will delete the item, all studio stock levels, and all stock movement history for this item.',
        })
        if (!confirmed) {
            openEditDialog(itemToDelete)
            return
        }

        await deleteItemMutation.mutateAsync({ itemId: itemToDelete.id })
    }

    const createUsageRule = async (values: UsageRuleFormValues) => {
        await createUsageRuleMutation.mutateAsync(values)
    }

    const updateUsageRule = async (values: UsageRuleFormValues) => {
        if (!editingUsageRule) return

        await updateUsageRuleMutation.mutateAsync({ ruleId: editingUsageRule.id, rule: values })
    }

    const deleteUsageRule = async () => {
        if (!editingUsageRule) return

        const usageRuleToDelete = editingUsageRule
        closeEditUsageRuleDialog()

        const confirmed = await confirm({
            title: `Delete usage rule ${usageRuleToDelete.label || usageRuleToDelete.inventoryKey}?`,
            description: 'This removes the rule from future shopping-list generation. It does not change stock counts.',
        })
        if (!confirmed) {
            openEditUsageRuleDialog(usageRuleToDelete)
            return
        }

        await deleteUsageRuleMutation.mutateAsync({ ruleId: usageRuleToDelete.id })
    }

    const setItemStocked = async (item: ClientInventoryItem, stocked: boolean) => {
        await setStockedMutation.mutateAsync({ itemId: item.id, location, stocked })
    }

    const submitStockAction = async (values: StockActionFormValues) => {
        if (!stockAction) return

        const itemId = stockAction.item.id
        const reason = values.reason || undefined
        switch (stockAction.$type) {
            case 'receive':
                await receiveStockMutation.mutateAsync({
                    location,
                    lines: [{ itemId, quantity: values.quantity }],
                    note: reason,
                })
                return
            case 'count':
                await countStockMutation.mutateAsync({
                    location,
                    lines: [{ itemId, quantity: values.quantity }],
                    reason,
                })
                return
            case 'remove':
                await removeStockMutation.mutateAsync({
                    location,
                    itemId,
                    quantity: values.quantity,
                    reason: values.reason,
                })
                return
            case 'level':
                await updateStockLevelMutation.mutateAsync({ location, itemId, level: values.level })
                return
        }
    }

    const receiveDelivery = async (input: { lines: { itemId: string; quantity: number }[]; note: string }) => {
        await receiveStockMutation.mutateAsync({ location, lines: input.lines, note: input.note || undefined })
        setReceiveDeliveryOpen(false)
    }

    const countAll = async (input: { lines: { itemId: string; quantity: number }[]; reason: string }) => {
        await countStockMutation.mutateAsync({ location, lines: input.lines, reason: input.reason || undefined })
        setCountAllOpen(false)
    }

    const markQuantityUnknown = async (item: ClientInventoryItem) => {
        await countStockMutation.mutateAsync({
            location,
            lines: [{ itemId: item.id, quantity: null }],
            reason: 'Marked count unknown.',
        })
    }

    return {
        isStockChangePending:
            receiveStockMutation.isPending ||
            countStockMutation.isPending ||
            removeStockMutation.isPending ||
            updateStockLevelMutation.isPending,
        isCreatingItem: createItemMutation.isPending,
        isCreatingUsageRule: createUsageRuleMutation.isPending,
        isDeletingItem: deleteItemMutation.isPending,
        isDeletingUsageRule: deleteUsageRuleMutation.isPending,
        isSetStockedPending: setStockedMutation.isPending,
        isUpdatingItem: updateItemMutation.isPending,
        isUpdatingUsageRule: updateUsageRuleMutation.isPending,
        countAll,
        createItem,
        createUsageRule,
        deleteItem,
        deleteUsageRule,
        markQuantityUnknown,
        receiveDelivery,
        setItemStocked,
        submitStockAction,
        updateItem,
        updateUsageRule,
    }
}
