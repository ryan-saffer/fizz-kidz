import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useFormContext, useWatch } from 'react-hook-form'

import {
    CAKE_SUPPLIES_PER_CHILD,
    INVENTORY_CATEGORIES,
    isLinkedInventoryCategory,
    isOrderableInventoryCategory,
} from '@fizz-kidz/core'
import type { InventoryCategory, InventoryItem } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { Button } from '@shared/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { Input } from '@shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Textarea } from '@shared/components/ui/textarea'

import { primaryButtonClass } from '../../utils/inventory.constants'
import {
    defaultInventoryItemFormValues,
    inventoryItemFormSchema,
    normalizeInventoryItemFormValues,
} from '../../utils/inventory.form-schemas'
import { formatCategory } from '../../utils/inventory.utils'

import type { InventoryItemFormInput, InventoryItemFormValues } from '../../utils/inventory.form-schemas'
import type { ClientInventoryItem, TrackingMode } from '../../utils/inventory.types'

export function InventoryItemForm({
    defaultValues,
    isPending,
    onSubmit,
    onDelete,
    submitLabel,
    item,
}: {
    defaultValues?: InventoryItemFormInput
    isPending: boolean
    onSubmit: (values: InventoryItemFormValues) => void
    onDelete?: () => void
    submitLabel: string
    item?: ClientInventoryItem | null
}) {
    const form = useForm<InventoryItemFormInput>({
        resolver: zodResolver(inventoryItemFormSchema),
        defaultValues: defaultValues ?? defaultInventoryItemFormValues,
    })
    const trackingMode = useWatch({ control: form.control, name: '$trackingMode' })
    const category = useWatch({ control: form.control, name: 'category' })

    useEffect(() => {
        form.reset(defaultValues ?? defaultInventoryItemFormValues)
    }, [defaultValues, form])

    return (
        <Form {...form}>
            <form
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit((values) => onSubmit(normalizeInventoryItemFormValues(values)))}
            >
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Item name</FormLabel>
                            <FormControl>
                                <Input placeholder="Party pies" disabled={isPending} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select
                                    value={field.value}
                                    disabled={isPending}
                                    onValueChange={(category) => field.onChange(category as InventoryCategory)}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {INVENTORY_CATEGORIES.map((category) => (
                                            <SelectItem key={category} value={category}>
                                                {formatCategory(category)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="$trackingMode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tracking</FormLabel>
                                <Select
                                    value={field.value}
                                    disabled={isPending}
                                    onValueChange={($trackingMode) => field.onChange($trackingMode as TrackingMode)}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tracking" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="quantity">Exact quantity</SelectItem>
                                        <SelectItem value="qualitative">High / medium / low</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="baseUnit"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Counted in</FormLabel>
                                <FormControl>
                                    <Input placeholder="bag" disabled={isPending} {...field} />
                                </FormControl>
                                <p className="m-0 text-xs leading-relaxed text-slate-500">
                                    What one of these is, in the singular. For example: cake, bag, pack, box, tray or
                                    kg.
                                </p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {trackingMode === 'quantity' ? (
                        <>
                            <FormField
                                control={form.control}
                                name="runningLowThreshold"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Running low threshold</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode="decimal"
                                                placeholder="20"
                                                disabled={isPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <p className="m-0 text-xs leading-relaxed text-slate-500">
                                            Time to reorder at or below this count. The studio owners are emailed when
                                            it gets here. Customer-ordered items use what&apos;s still available to
                                            order. Leave blank to disable.
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </>
                    ) : null}
                </div>

                {trackingMode === 'quantity' && isLinkedInventoryCategory(category) ? (
                    <SquareLinkField isPending={isPending} category={category} itemId={item?.id} />
                ) : null}
                {trackingMode === 'quantity' && category === 'cake-supplies' ? (
                    <FormField
                        control={form.control}
                        name="usedPer"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Used per party</FormLabel>
                                <Select
                                    value={field.value || undefined}
                                    disabled={isPending}
                                    onValueChange={field.onChange}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="How much a party uses" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="party">One per party (eg. a pack of candles)</SelectItem>
                                        <SelectItem value="child">
                                            {CAKE_SUPPLIES_PER_CHILD} per child, rounded up (eg. cups, spoons)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="m-0 text-xs leading-relaxed text-slate-500">
                                    Taken off stock when the party is paid on the studio terminal.
                                </p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select
                                    value={field.value}
                                    disabled={isPending}
                                    onValueChange={(status) => field.onChange(status as InventoryItem['status'])}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="archived">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="m-0 text-xs leading-relaxed text-slate-500">
                                    Archive items instead of deleting them once they have history.
                                </p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Supplier, storage notes, or counting guidance."
                                    disabled={isPending}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {onDelete && item ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            disabled={isPending}
                            onClick={onDelete}
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete item
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button type="submit" className={primaryButtonClass} disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </Form>
    )
}

const SQUARE_LINK_COPY = {
    cakes: {
        label: 'Ordered by customers as',
        description:
            "The cake design in Square that parents order. This is how the party form shows what's available and reserves it.",
    },
    'take-home-bags': {
        label: 'Ordered by customers as',
        description:
            "The take-home bag in Square that parents order. This is how the party form shows what's available and reserves it.",
    },
    'cake-supplies': {
        label: 'Used by',
        description:
            'The serving or candle option on the party form that uses this up. Cups and spoons can both use the same option.',
    },
}

/** Linking an item to what customers order in Square makes it orderable: party form orders reserve it. */
function SquareLinkField({
    isPending,
    category,
    itemId,
}: {
    isPending: boolean
    category: InventoryCategory
    /** The item being edited, so its own link isn't shown as taken. */
    itemId?: string
}) {
    const trpc = useTRPC()
    const form = useFormContext<InventoryItemFormInput>()
    const optionsQuery = useQuery(trpc.inventory.listSquareOptions.queryOptions())
    const itemsQuery = useQuery(trpc.inventory.listItems.queryOptions({ includeArchived: true }))
    // each cake design or bag can only be linked to one item; cake supplies can share an option (cups and spoons)
    const linkedTo = new Map(
        isOrderableInventoryCategory(category)
            ? (itemsQuery.data ?? []).flatMap((item) =>
                  item.id !== itemId &&
                  isOrderableInventoryCategory(item.category) &&
                  item.$trackingMode === 'quantity' &&
                  item.squareCatalogObjectId
                      ? [[item.squareCatalogObjectId, item.name] as const]
                      : []
              )
            : []
    )
    const options = (optionsQuery.data ?? []).filter((option) => option.category === category)
    const copy = SQUARE_LINK_COPY[category as keyof typeof SQUARE_LINK_COPY]

    return (
        <FormField
            control={form.control}
            name="squareCatalogObjectId"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{copy.label}</FormLabel>
                    <Select
                        value={field.value || undefined}
                        disabled={isPending || optionsQuery.isPending}
                        onValueChange={field.onChange}
                    >
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue
                                    placeholder={optionsQuery.isPending ? 'Loading Square…' : 'Choose from Square'}
                                />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {options.map((option) => (
                                <SelectItem key={option.id} value={option.id} disabled={linkedTo.has(option.id)}>
                                    {option.name}
                                    {linkedTo.has(option.id) ? ` (linked to ${linkedTo.get(option.id)})` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="m-0 text-xs leading-relaxed text-slate-500">{copy.description}</p>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
