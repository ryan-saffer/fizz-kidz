import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/components/ui/dialog'
import { getOrgName } from '@shared/lib/studio-utils'

import { useInventoryActions } from '../../hooks/use-inventory-actions'
import { useInventoryData } from '../../hooks/use-inventory-data'
import { useInventoryLocation } from '../../hooks/use-inventory-location'
import { useInventoryStore } from '../../state/inventory-store'
import { inventoryItemToFormValues, usageRuleToFormValues } from '../../utils/inventory.form-schemas'
import { getStockActionDescription, getStockActionTitle } from '../../utils/inventory.utils'
import { CountAllForm } from '../inventory/count-all-form'
import { InventoryItemForm } from '../inventory/inventory-item-form'
import { ReceiveDeliveryForm } from '../inventory/receive-delivery-form'
import { StockActionForm } from '../inventory/stock-action-form'
import { StockHistory } from '../inventory/stock-history'
import { UsageRuleForm } from '../usage-rules/usage-rule-form'

export function InventoryDialogs() {
    return (
        <>
            <EditInventoryItemDialog />
            <EditUsageRuleDialog />
            <StockActionDialog />
            <ReceiveDeliveryDialog />
            <CountAllDialog />
            <StockHistoryDialog />
        </>
    )
}

function EditInventoryItemDialog() {
    const actions = useInventoryActions()
    const item = useInventoryStore((state) => state.editingItem)
    const closeEditDialog = useInventoryStore((state) => state.closeEditDialog)

    return (
        <Dialog open={!!item} onOpenChange={(open) => !open && closeEditDialog()}>
            <DialogContent className="twp max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit inventory item</DialogTitle>
                    <DialogDescription>Update this catalogue item across all locations.</DialogDescription>
                </DialogHeader>
                <InventoryItemForm
                    defaultValues={item ? inventoryItemToFormValues(item) : undefined}
                    isPending={actions.isUpdatingItem || actions.isDeletingItem}
                    submitLabel="Save changes"
                    item={item}
                    onDelete={actions.deleteItem}
                    onSubmit={actions.updateItem}
                />
            </DialogContent>
        </Dialog>
    )
}

function EditUsageRuleDialog() {
    const actions = useInventoryActions()
    const usageRule = useInventoryStore((state) => state.editingUsageRule)
    const closeEditUsageRuleDialog = useInventoryStore((state) => state.closeEditUsageRuleDialog)

    return (
        <Dialog open={!!usageRule} onOpenChange={(open) => !open && closeEditUsageRuleDialog()}>
            <DialogContent className="twp max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit usage rule</DialogTitle>
                    <DialogDescription>Update how this item appears in generated shopping lists.</DialogDescription>
                </DialogHeader>
                <UsageRuleForm
                    defaultValues={usageRule ? usageRuleToFormValues(usageRule) : undefined}
                    isPending={actions.isUpdatingUsageRule || actions.isDeletingUsageRule}
                    submitLabel="Save rule"
                    usageRule={usageRule}
                    onDelete={actions.deleteUsageRule}
                    onSubmit={actions.updateUsageRule}
                />
            </DialogContent>
        </Dialog>
    )
}

function StockActionDialog() {
    const actions = useInventoryActions()
    const { location } = useInventoryLocation()
    const action = useInventoryStore((state) => state.stockAction)
    const closeStockActionDialog = useInventoryStore((state) => state.closeStockActionDialog)

    return (
        <Dialog open={!!action} onOpenChange={(open) => !open && closeStockActionDialog()}>
            <DialogContent className="twp max-w-xl">
                {action ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>{getStockActionTitle(action)}</DialogTitle>
                            <DialogDescription>{getStockActionDescription(action, location)}</DialogDescription>
                        </DialogHeader>
                        <StockActionForm
                            action={action}
                            isPending={actions.isStockChangePending}
                            onSubmit={actions.submitStockAction}
                        />
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

function ReceiveDeliveryDialog() {
    const actions = useInventoryActions()
    const data = useInventoryData()
    const open = useInventoryStore((state) => state.isReceiveDeliveryOpen)
    const setOpen = useInventoryStore((state) => state.setReceiveDeliveryOpen)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="twp max-w-xl">
                <DialogHeader>
                    <DialogTitle>Receive a delivery at {getOrgName(data.location)}</DialogTitle>
                    <DialogDescription>
                        For the monthly cake and take-home bag delivery. A supervisor, area manager or franchisee should
                        check the delivery before it's entered.
                    </DialogDescription>
                </DialogHeader>
                {open ? (
                    <ReceiveDeliveryForm
                        items={data.receivableItems}
                        stockByItemId={data.stockByItemId}
                        isPending={actions.isStockChangePending}
                        onSubmit={actions.receiveDelivery}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

function CountAllDialog() {
    const actions = useInventoryActions()
    const data = useInventoryData()
    const open = useInventoryStore((state) => state.isCountAllOpen)
    const setOpen = useInventoryStore((state) => state.setCountAllOpen)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="twp max-w-xl">
                <DialogHeader>
                    <DialogTitle>Count cakes & bags at {getOrgName(data.location)}</DialogTitle>
                    <DialogDescription>
                        A stocktake of the freezer and bag shelf. Not for entering a delivery: use Receive for that.
                    </DialogDescription>
                </DialogHeader>
                {open ? (
                    <CountAllForm
                        items={data.receivableItems}
                        stockByItemId={data.stockByItemId}
                        isPending={actions.isStockChangePending}
                        onSubmit={actions.countAll}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

function StockHistoryDialog() {
    const { location } = useInventoryLocation()
    const item = useInventoryStore((state) => state.historyItem)
    const closeHistoryDialog = useInventoryStore((state) => state.closeHistoryDialog)

    return (
        <Dialog open={!!item} onOpenChange={(open) => !open && closeHistoryDialog()}>
            <DialogContent className="twp max-w-xl">
                {item ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>{item.name} history</DialogTitle>
                            <DialogDescription>
                                Every stock change at {getOrgName(location)}, newest first.
                            </DialogDescription>
                        </DialogHeader>
                        <StockHistory item={item} location={location} />
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
