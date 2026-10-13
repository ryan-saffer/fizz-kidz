import { Loader2, PackageSearch, Plus } from 'lucide-react'

import { assertNever } from '@fizz-kidz/core'
import type { InventoryUsageRuleQuantity } from '@fizz-kidz/core'

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'

import { useInventoryActions } from '../../hooks/use-inventory-actions'
import { useInventoryUsageRules } from '../../hooks/use-inventory-usage-rules'
import { useInventoryStore } from '../../state/inventory-store'
import { primaryButtonClass } from '../../utils/inventory.constants'
import { defaultUsageRuleFormValues } from '../../utils/inventory.form-schemas'
import { getUsageRuleNameLabel, getUsageRuleTypeLabel } from '../../utils/inventory.usage-rules'
import { UsageRuleForm } from './usage-rule-form'

export function InventoryUsageRulesCard() {
    const { canEdit, isLoading, usageRules } = useInventoryUsageRules()
    const actions = useInventoryActions()
    const isCreateDialogOpen = useInventoryStore((state) => state.isCreateUsageRuleDialogOpen)
    const setCreateDialogOpen = useInventoryStore((state) => state.setCreateUsageRuleDialogOpen)
    const openEditUsageRuleDialog = useInventoryStore((state) => state.openEditUsageRuleDialog)

    if (!canEdit) {
        return null
    }

    return (
        <Card className="rounded-3xl border-white bg-white/90 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
            <CardHeader className="gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <PackageSearch className="h-5 w-5 text-[#007f93]" /> Usage rules
                        </CardTitle>
                        <CardDescription>
                            Tell the shopping list which item key to use and how much is needed per booking or child.
                        </CardDescription>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className={primaryButtonClass}>
                                <Plus className="mr-2 h-4 w-4" /> Create rule
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="twp max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Create usage rule</DialogTitle>
                                <DialogDescription>
                                    Choose a type and short name. The matching inventory key is generated automatically.
                                </DialogDescription>
                            </DialogHeader>
                            <UsageRuleForm
                                defaultValues={defaultUsageRuleFormValues}
                                isPending={actions.isCreatingUsageRule}
                                submitLabel="Create rule"
                                onSubmit={actions.createUsageRule}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 text-sm text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading usage rules
                    </div>
                ) : usageRules.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                        <p className="m-0 text-sm font-semibold text-slate-700">No usage rules yet.</p>
                        <p className="m-1 text-sm text-slate-500">
                            Create a rule for each party item that should appear in shopping lists.
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Rule</TableHead>
                                <TableHead>Generated key</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usageRules.map((rule) => (
                                <TableRow key={rule.id}>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-semibold text-slate-950">
                                                {rule.label ||
                                                    getUsageRuleNameLabel(rule.$type, getUsageRuleName(rule))}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {getUsageRuleTypeLabel(rule.$type)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-mono text-xs text-slate-600">{rule.inventoryKey}</span>
                                    </TableCell>
                                    <TableCell>{formatRuleQuantity(rule.quantity)}</TableCell>
                                    <TableCell>
                                        <Badge className="w-fit rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-100">
                                            {rule.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-[#AC4390]/30 text-[#AC4390] hover:bg-[#AC4390]/10 hover:text-[#AC4390]"
                                            onClick={() => openEditUsageRuleDialog(rule)}
                                        >
                                            Edit
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}

function getUsageRuleName(rule: ReturnType<typeof useInventoryUsageRules>['usageRules'][number]) {
    if (rule.$type === 'party-addition') {
        return rule.addition
    }

    return rule.inventoryKey.split(':').slice(1).join(':')
}

function formatRuleQuantity(quantity: InventoryUsageRuleQuantity) {
    switch (quantity.$operation) {
        case 'fixed':
            return `${quantity.quantity} per booking`
        case 'per-child':
            return `${quantity.quantityPerChild} per child`
        case 'fixed-plus-per-child':
            return `${quantity.fixedQuantity} per booking + ${quantity.quantityPerChild} per child`
        default:
            assertNever(quantity)
            throw new Error(`Unhandled quantity.$operation: ${JSON.stringify(quantity)}`)
    }
}
