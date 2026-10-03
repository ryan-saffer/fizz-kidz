import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'

import { primaryButtonClass } from '../../utils/inventory.constants'
import { getReceiveDeliveryLines, receiveDeliveryFormSchema } from '../../utils/inventory.form-schemas'
import { getCurrentQuantity } from '../../utils/inventory.utils'
import { InventoryNotice } from '../shared/inventory-notice'

import type { ReceiveDeliveryFormInput } from '../../utils/inventory.form-schemas'
import type { ClientInventoryItem, ClientInventoryStockLevel } from '../../utils/inventory.types'

/**
 * Receiving a delivery is deliberately separate from counting: reserved stock is already in the freezer and isn't
 * labelled, so a delivery is entered from what arrived, never from a count of what's there afterwards.
 */
export function ReceiveDeliveryForm({
    items,
    stockByItemId,
    isPending,
    onSubmit,
}: {
    items: ClientInventoryItem[]
    stockByItemId: Map<string, ClientInventoryStockLevel>
    isPending: boolean
    onSubmit: (input: { lines: { itemId: string; quantity: number }[]; note: string }) => void
}) {
    const form = useForm<ReceiveDeliveryFormInput>({
        resolver: zodResolver(receiveDeliveryFormSchema),
        defaultValues: { quantities: Object.fromEntries(items.map((item) => [item.id, ''])), note: '', checked: false },
    })

    if (items.length === 0) {
        return <p className="m-0 text-sm text-slate-500">No cakes or take-home bags are tracked at this studio yet.</p>
    }

    return (
        <Form {...form}>
            <form
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit((values) =>
                    onSubmit({ lines: getReceiveDeliveryLines(values), note: values.note })
                )}
            >
                <InventoryNotice tone="warning">
                    Enter only what came off the delivery, after checking it against the delivery docket.{' '}
                    <strong>Don&apos;t count the freezer</strong>: some of what&apos;s already there is reserved for
                    upcoming parties. If something doesn&apos;t look right, use Count on that item afterwards.
                </InventoryNotice>

                <div className="flex flex-col divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                    {items.map((item) => (
                        <FormField
                            key={item.id}
                            control={form.control}
                            name={`quantities.${item.id}`}
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between gap-4 space-y-0 px-3 py-2">
                                    <div className="flex flex-col">
                                        <FormLabel className="font-semibold text-slate-900">{item.name}</FormLabel>
                                        <span className="text-xs text-slate-500">
                                            {getCurrentQuantity(stockByItemId.get(item.id)) ?? 0} here now
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <FormControl>
                                            <Input
                                                className="w-24 text-right"
                                                inputMode="numeric"
                                                placeholder="0"
                                                aria-label={`${item.name} received`}
                                                disabled={isPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </div>
                                </FormItem>
                            )}
                        />
                    ))}
                </div>

                <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes (optional)</FormLabel>
                            <FormControl>
                                <Textarea
                                    disabled={isPending}
                                    placeholder="eg. October delivery, docket #123"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="checked"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-start gap-3">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        disabled={isPending}
                                        onCheckedChange={(checked) => field.onChange(checked === true)}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal leading-snug">
                                    I physically checked every item and quantity in this delivery.
                                </FormLabel>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className={primaryButtonClass} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Receive delivery
                </Button>
            </form>
        </Form>
    )
}
