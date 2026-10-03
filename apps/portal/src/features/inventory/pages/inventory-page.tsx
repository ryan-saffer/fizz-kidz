import { InventoryCatalogueCard } from '../components/inventory/inventory-catalogue-card'
import { InventoryDialogs } from '../components/shared/inventory-dialogs'
import { InventoryPageHeader } from '../components/shared/inventory-page-header'
import { useInventoryData } from '../hooks/use-inventory-data'

// The shopping list and usage rules are parked until party food is being tracked; their components are kept.
export function InventoryPage() {
    const { itemCount, trackedStockCount } = useInventoryData()

    return (
        <div className="twp min-h-[calc(100vh-4rem)] bg-gradient-to-br from-[#effcff] via-[#f7fbff] to-[#eef5ff] px-4 py-6 sm:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <InventoryPageHeader itemCount={itemCount} trackedCount={trackedStockCount} />
                <InventoryCatalogueCard />
                <InventoryDialogs />
            </div>
        </div>
    )
}
