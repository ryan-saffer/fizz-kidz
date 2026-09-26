import { Check, ImageIcon, Minus, Plus } from 'lucide-react'

import { cn } from '@shared/lib/tailwind'

const MAX_QUANTITY = 30

/**
 * A photo card with a quantity stepper. New items are sold in lots of at least `minimum`, so adding the first one jumps
 * straight to the minimum and removing below it clears the item. Top-ups of an earlier order use a minimum of 1.
 */
export function QuantityCard({
    name,
    description,
    imageUrl,
    price,
    minimum,
    alreadyOrdered = 0,
    value,
    onChange,
}: {
    name: string
    description?: string | null
    imageUrl: string | null
    price: string
    minimum: number
    /** Ordered earlier (e.g. with the cake form). New quantities are added on top. */
    alreadyOrdered?: number
    value: number
    onChange: (value: number) => void
}) {
    const stepButton =
        'grid h-9 w-9 place-items-center rounded-full text-party-pink enabled:hover:bg-[#f3e8f5] disabled:opacity-30'
    return (
        <div
            className={cn(
                'flex flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-white shadow-[0_3px_16px_#3024400a] transition-colors',
                value > 0 && 'border-party-pink bg-party-tint'
            )}
        >
            <div className="relative grid aspect-square place-items-center bg-party-placeholder text-[#b6a1c3]">
                {imageUrl ? (
                    <img className="absolute inset-0 h-full w-full object-cover" src={imageUrl} alt="" loading="lazy" />
                ) : (
                    <ImageIcon size={28} aria-hidden="true" />
                )}
            </div>
            <div className="flex flex-1 flex-col gap-3 px-3.5 pb-3.5 pt-3">
                <div>
                    <p className="text-sm font-semibold leading-[1.35]">{name}</p>
                    {description && <p className="pt-1 text-xs leading-[1.45] text-party-muted">{description}</p>}
                    <p className="pt-1 text-[13px] text-party-muted">{price}</p>
                </div>
                <div className="mt-auto grid gap-2">
                    {alreadyOrdered > 0 && (
                        <p className="flex items-center gap-1.5 rounded-lg bg-party-lilac px-2.5 py-1.5 text-xs font-semibold text-party-pink">
                            <Check size={14} aria-hidden="true" /> {alreadyOrdered} already ordered
                        </p>
                    )}
                    <div
                        className="flex items-center justify-between rounded-full border border-party-line bg-white p-[3px]"
                        role="group"
                        aria-label={`${name} quantity`}
                    >
                        <button
                            type="button"
                            className={stepButton}
                            aria-label={`Remove one ${name}`}
                            disabled={value === 0}
                            onClick={() => onChange(value <= minimum ? 0 : value - 1)}
                        >
                            <Minus size={16} aria-hidden="true" />
                        </button>
                        <output
                            className="text-center text-sm tabular-nums"
                            aria-live="polite"
                            aria-label={`${name} quantity`}
                        >
                            {value}
                        </output>
                        <button
                            type="button"
                            className={stepButton}
                            aria-label={`Add one ${name}`}
                            disabled={value >= MAX_QUANTITY}
                            onClick={() => onChange(value === 0 ? minimum : value + 1)}
                        >
                            <Plus size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
