import type { InventoryActor } from '@fizz-kidz/core'

import {
    inventoryLocationReadProcedure,
    inventoryLocationUpdateStockProcedure,
    inventoryManageItemsProcedure,
    inventoryReadProcedure,
    inventoryShoppingListProcedure,
} from './trpc.inventory-procedures'

import { router } from '@/app/trpc/trpc'
import { createInventoryItem, createInventoryItemInputSchema } from '@/features/inventory/core/inventory.items.create'
import { deleteInventoryItem, deleteInventoryItemInputSchema } from '@/features/inventory/core/inventory.items.delete'
import { listInventoryItems, listInventoryItemsInputSchema } from '@/features/inventory/core/inventory.items.list'
import { updateInventoryItem, updateInventoryItemInputSchema } from '@/features/inventory/core/inventory.items.update'
import {
    generateInventoryShoppingList,
    generateInventoryShoppingListInputSchema,
} from '@/features/inventory/core/inventory.shopping-list.generate'
import { listInventorySquareOptions } from '@/features/inventory/core/inventory.square-options.list'
import {
    listInventoryStockMovements,
    listInventoryStockMovementsInputSchema,
} from '@/features/inventory/core/inventory.stock-movements.list'
import { countInventoryStock, countInventoryStockInputSchema } from '@/features/inventory/core/inventory.stock.count'
import { listInventoryStock, listInventoryStockInputSchema } from '@/features/inventory/core/inventory.stock.list'
import {
    receiveInventoryStock,
    receiveInventoryStockInputSchema,
} from '@/features/inventory/core/inventory.stock.receive'
import { removeInventoryStock, removeInventoryStockInputSchema } from '@/features/inventory/core/inventory.stock.remove'
import {
    setInventoryStocked,
    setInventoryStockedInputSchema,
} from '@/features/inventory/core/inventory.stock.set-stocked'
import {
    updateInventoryStockLevel,
    updateInventoryStockLevelInputSchema,
} from '@/features/inventory/core/inventory.stock.update-level'
import {
    createInventoryUsageRule,
    createInventoryUsageRuleInputSchema,
} from '@/features/inventory/core/inventory.usage-rules.create'
import {
    deleteInventoryUsageRule,
    deleteInventoryUsageRuleInputSchema,
} from '@/features/inventory/core/inventory.usage-rules.delete'
import {
    listInventoryUsageRules,
    listInventoryUsageRulesInputSchema,
} from '@/features/inventory/core/inventory.usage-rules.list'
import {
    updateInventoryUsageRule,
    updateInventoryUsageRuleInputSchema,
} from '@/features/inventory/core/inventory.usage-rules.update'

export const inventoryRouter = router({
    listItems: inventoryReadProcedure
        .input(listInventoryItemsInputSchema)
        .query(({ input }) => listInventoryItems(input)),
    createItem: inventoryManageItemsProcedure
        .input(createInventoryItemInputSchema)
        .mutation(({ input }) => createInventoryItem(input)),
    updateItem: inventoryManageItemsProcedure
        .input(updateInventoryItemInputSchema)
        .mutation(({ input }) => updateInventoryItem(input)),
    deleteItem: inventoryManageItemsProcedure
        .input(deleteInventoryItemInputSchema)
        .mutation(({ input }) => deleteInventoryItem(input)),
    listSquareOptions: inventoryManageItemsProcedure.query(() => listInventorySquareOptions()),
    listStock: inventoryLocationReadProcedure
        .input(listInventoryStockInputSchema)
        .query(({ input }) => listInventoryStock(input)),
    receiveStock: inventoryLocationUpdateStockProcedure
        .input(receiveInventoryStockInputSchema)
        .mutation(({ ctx, input }) => receiveInventoryStock(input, getActor(ctx))),
    countStock: inventoryLocationUpdateStockProcedure
        .input(countInventoryStockInputSchema)
        .mutation(({ ctx, input }) => countInventoryStock(input, getActor(ctx))),
    removeStock: inventoryLocationUpdateStockProcedure
        .input(removeInventoryStockInputSchema)
        .mutation(({ ctx, input }) => removeInventoryStock(input, getActor(ctx))),
    updateStockLevel: inventoryLocationUpdateStockProcedure
        .input(updateInventoryStockLevelInputSchema)
        .mutation(({ ctx, input }) => updateInventoryStockLevel(input, getActor(ctx))),
    setStocked: inventoryLocationUpdateStockProcedure
        .input(setInventoryStockedInputSchema)
        .mutation(({ input }) => setInventoryStocked(input)),
    listMovements: inventoryLocationReadProcedure
        .input(listInventoryStockMovementsInputSchema)
        .query(({ input }) => listInventoryStockMovements(input)),
    listUsageRules: inventoryReadProcedure
        .input(listInventoryUsageRulesInputSchema)
        .query(({ input }) => listInventoryUsageRules(input)),
    createUsageRule: inventoryManageItemsProcedure
        .input(createInventoryUsageRuleInputSchema)
        .mutation(({ input }) => createInventoryUsageRule(input)),
    updateUsageRule: inventoryManageItemsProcedure
        .input(updateInventoryUsageRuleInputSchema)
        .mutation(({ input }) => updateInventoryUsageRule(input)),
    deleteUsageRule: inventoryManageItemsProcedure
        .input(deleteInventoryUsageRuleInputSchema)
        .mutation(({ input }) => deleteInventoryUsageRule(input)),
    generateShoppingList: inventoryShoppingListProcedure
        .input(generateInventoryShoppingListInputSchema)
        .query(({ input }) => generateInventoryShoppingList(input)),
})

function getActor(ctx: { uid: string; email: string }): InventoryActor {
    return { $type: 'staff', uid: ctx.uid, email: ctx.email }
}
