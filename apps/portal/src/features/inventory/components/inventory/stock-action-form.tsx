import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { INVENTORY_QUALITATIVE_STOCK_LEVELS, isOrderableInventoryItem } from '@fizz-kidz/core'
import type { InventoryQualitativeStockLevel } from '@fizz-kidz/core'

import { Button } from '@shared/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Textarea } from '@shared/components/ui/textarea'

import { primaryButtonClass } from '../../utils/inventory.constants'
import {
    getStockActionFormDefaultValues,
    getStockActionFormSchema,
    normalizeStockActionFormValues,
} from '../../utils/inventory.form-schemas'
import { formatQualitativeLevel, getCurrentQuantity, getStockActionSubmitLabel } from '../../utils/inventory.utils'
import { InventoryNotice } from '../shared/inventory-notice'

import type { StockActionFormInput, StockActionFormValues } from '../../utils/inventory.form-schemas'
import type { StockAction } from '../../utils/inventory.types'

export function StockActionForm({
    action,
    isPending,
    onSubmit,
}: {
    action: StockAction
    isPending: boolean
    onSubmit: (values: StockActionFormValues) => void
}) {
    const form = useForm<StockActionFormInput>({
        resolver: zodResolver(getStockActionFormSchema(action)),
        defaultValues: getStockActionFormDefaultValues(action),
    })
    const enteredQuantity = useWatch({ control: form.control, name: 'quantity' })
    const currentQuantity = getCurrentQuantity(action.stock)
    const reserved = action.stock?.reservedQuantity ?? 0
    const isOrderable = isOrderableInventoryItem(action.item)

    useEffect(() => {
        form.reset(getStockActionFormDefaultValues(action))
    }, [action, form])

    const entered = enteredQuantity === '' ? null : Number(enteredQuantity)
    const quantityAfter =
        entered === null || !Number.isInteger(entered)
            ? null
            : action.$type === 'count'
              ? entered
              : action.$type === 'remove' && currentQuantity !== null
                ? currentQuantity - entered
                : null
    const isMismatch = action.$type === 'count' && entered !== null && entered !== currentQuantity
    const willBeShort = isOrderable && quantityAfter !== null && quantityAfter < reserved

    return (
        <Form {...form}>
            <form
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit((values) => onSubmit(normalizeStockActionFormValues(values)))}
            >
                {isOrderable && action.$type === 'count' ? (
                    <InventoryNotice tone="info">
                        Count <strong>everything</strong> physically here, including stock reserved for upcoming
                        parties. Reserved stock isn&apos;t labelled, so don&apos;t try to work out which is which. The
                        system has {currentQuantity} on hand ({reserved} reserved). If your count is different, say why.
                        The studio owners will be emailed.
                    </InventoryNotice>
                ) : null}

                {action.$type === 'level' ? (
                    <FormField
                        control={form.control}
                        name="level"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Stock level</FormLabel>
                                <Select
                                    value={field.value}
                                    disabled={isPending}
                                    onValueChange={(level) => field.onChange(level as InventoryQualitativeStockLevel)}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select level" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {INVENTORY_QUALITATIVE_STOCK_LEVELS.map((level) => (
                                            <SelectItem key={level} value={level}>
                                                {formatQualitativeLevel(level)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : (
                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{getQuantityLabel(action)}</FormLabel>
                                <FormControl>
                                    <Input inputMode="numeric" disabled={isPending} placeholder="0" {...field} />
                                </FormControl>
                                {action.$type !== 'receive' && !isOrderable ? (
                                    <p className="m-0 text-xs leading-relaxed text-slate-500">
                                        {currentQuantity === null
                                            ? 'The recorded count is unknown.'
                                            : `The recorded count is ${currentQuantity}.`}
                                    </p>
                                ) : null}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {willBeShort ? (
                    <InventoryNotice tone="danger">
                        That leaves {quantityAfter} on hand but {reserved} are reserved for upcoming parties, so some
                        parties will be short. The studio owners will be emailed to sort it out.
                    </InventoryNotice>
                ) : null}

                {action.$type !== 'level' ? (
                    <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{getReasonLabel(action, isOrderable && isMismatch)}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        disabled={isPending}
                                        placeholder={getReasonPlaceholder(action)}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : null}

                <Button type="submit" className={primaryButtonClass} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isOrderable && isMismatch ? <AlertTriangle className="mr-2 h-4 w-4" /> : null}
                    {getStockActionSubmitLabel(action)}
                </Button>
            </form>
        </Form>
    )
}

function getQuantityLabel(action: StockAction) {
    switch (action.$type) {
        case 'receive':
            return 'Quantity received'
        case 'remove':
            return 'Quantity to remove'
        default:
            return 'Counted quantity'
    }
}

function getReasonLabel(action: StockAction, needsReason: boolean) {
    if (action.$type === 'remove' || needsReason) return 'Reason'
    return 'Notes (optional)'
}

function getReasonPlaceholder(action: StockAction) {
    switch (action.$type) {
        case 'receive':
            return 'Supplier, order or delivery notes.'
        case 'remove':
            return 'eg. Thrown out, past its best.'
        default:
            return 'Anything worth noting about this count.'
    }
}
