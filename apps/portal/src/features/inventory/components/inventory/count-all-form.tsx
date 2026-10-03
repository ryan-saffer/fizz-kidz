import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@shared/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { cn } from '@shared/lib/tailwind'

import { primaryButtonClass } from '../../utils/inventory.constants'
import { getCountAllFormSchema, getCountAllLines } from '../../utils/inventory.form-schemas'
import { getCurrentQuantity } from '../../utils/inventory.utils'
import { InventoryNotice } from '../shared/inventory-notice'

import type { CountAllFormInput } from '../../utils/inventory.form-schemas'
import type { ClientInventoryItem, ClientInventoryStockLevel } from '../../utils/inventory.types'

/** A stocktake of every cake and bag at once: count the whole freezer, including reserved stock. */
export function CountAllForm({
    items,
    stockByItemId,
    isPending,
    onSubmit,
}: {
    items: ClientInventoryItem[]
    stockByItemId: Map<string, ClientInventoryStockLevel>
    isPending: boolean
    onSubmit: (input: { lines: { itemId: string; quantity: number }[]; reason: string }) => void
}) {
    const recorded = new Map(items.map((item) => [item.id, getCurrentQuantity(stockByItemId.get(item.id))]))
    const form = useForm<CountAllFormInput>({
        resolver: zodResolver(getCountAllFormSchema(recorded)),
        defaultValues: { quantities: Object.fromEntries(items.map((item) => [item.id, ''])), reason: '' },
    })
    const quantities = useWatch({ control: form.control, name: 'quantities' })

    if (items.length === 0) {
        return <p className="m-0 text-sm text-slate-500">No cakes or take-home bags are tracked at this studio yet.</p>
    }

    const counted = (itemId: string) => {
        const value = quantities?.[itemId]
        return value === undefined || value === '' || !Number.isInteger(Number(value)) ? null : Number(value)
    }
    const mismatches = items.filter((item) => {
        const count = counted(item.id)
        return count !== null && count !== recorded.get(item.id)
    })
    const short = items.filter((item) => {
        const count = counted(item.id)
        return count !== null && count < (stockByItemId.get(item.id)?.reservedQuantity ?? 0)
    })

    return (
        <Form {...form}>
            <form
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit((values) =>
                    onSubmit({ lines: getCountAllLines(values), reason: values.reason })
                )}
            >
                <InventoryNotice tone="info">
                    Count <strong>everything</strong> in the freezer, including stock reserved for upcoming parties.
                    Reserved stock isn&apos;t labelled, so don&apos;t try to work out which is which. Leave a row blank
                    if you didn&apos;t count it.
                </InventoryNotice>

                <div className="flex flex-col divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                    {items.map((item) => {
                        const stock = stockByItemId.get(item.id)
                        const isMismatch = mismatches.includes(item)
                        return (
                            <FormField
                                key={item.id}
                                control={form.control}
                                name={`quantities.${item.id}`}
                                render={({ field }) => (
                                    <FormItem
                                        className={cn(
                                            'flex items-center justify-between gap-4 space-y-0 px-3 py-2',
                                            isMismatch && 'bg-amber-50'
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            <FormLabel className="font-semibold text-slate-900">{item.name}</FormLabel>
                                            <span className="text-xs text-slate-500">
                                                System has {getCurrentQuantity(stock) ?? 0} (
                                                {stock?.reservedQuantity ?? 0} reserved)
                                                {isMismatch ? ' · doesn’t match' : ''}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <FormControl>
                                                <Input
                                                    className="w-24 text-right"
                                                    inputMode="numeric"
                                                    placeholder="–"
                                                    aria-label={`${item.name} counted`}
                                                    disabled={isPending}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </div>
                                    </FormItem>
                                )}
                            />
                        )
                    })}
                </div>

                {short.length > 0 ? (
                    <InventoryNotice tone="danger">
                        {short.map((item) => item.name).join(', ')}: fewer counted than are reserved for upcoming
                        parties, so some parties will be short. The studio owners will be emailed to sort it out.
                    </InventoryNotice>
                ) : null}

                <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{mismatches.length > 0 ? 'Reason' : 'Notes (optional)'}</FormLabel>
                            <FormControl>
                                <Textarea
                                    disabled={isPending}
                                    placeholder={
                                        mismatches.length > 0
                                            ? 'eg. One unicorn cake was damaged and thrown out.'
                                            : 'Anything worth noting about this count.'
                                    }
                                    {...field}
                                />
                            </FormControl>
                            {mismatches.length > 0 ? (
                                <p className="m-0 text-xs leading-relaxed text-slate-500">
                                    {mismatches.length} {mismatches.length === 1 ? "count doesn't" : "counts don't"}{' '}
                                    match. The studio owners will be emailed.
                                </p>
                            ) : null}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className={primaryButtonClass} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save count
                </Button>
            </form>
        </Form>
    )
}
