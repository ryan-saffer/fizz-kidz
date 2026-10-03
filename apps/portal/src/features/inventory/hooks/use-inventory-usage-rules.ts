import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '@integrations/trpc'
import { useOrg } from '@session/use-org'

export function useInventoryUsageRules() {
    const trpc = useTRPC()
    const { hasPermission } = useOrg()
    const canEdit = hasPermission('inventory:manage-items')
    const usageRulesQuery = useQuery(
        trpc.inventory.listUsageRules.queryOptions({ includeArchived: true }, { enabled: canEdit })
    )

    return {
        canEdit,
        isLoading: usageRulesQuery.isPending,
        usageRules: (usageRulesQuery.data ?? []).sort((a, b) => a.inventoryKey.localeCompare(b.inventoryKey)),
        usageRulesQuery,
    }
}
