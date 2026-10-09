import { Check } from 'lucide-react'

import { cn } from '@shared/lib/tailwind'

import type { ReactNode } from 'react'

export function StepSection({
    title,
    description,
    children,
}: {
    title: string
    description?: ReactNode
    children: ReactNode
}) {
    return (
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                {description && <p className="text-sm text-slate-500">{description}</p>}
            </div>
            {children}
        </section>
    )
}

/** A large, tappable choice. */
export function OptionCard({
    selected,
    onSelect,
    title,
    detail,
    imageUrl,
}: {
    selected: boolean
    onSelect: () => void
    title: string
    detail?: ReactNode
    imageUrl?: string | null
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(
                'flex min-h-16 items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors',
                selected ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
            )}
        >
            {imageUrl !== undefined && <ItemImage url={imageUrl} />}
            <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{title}</span>
                {detail && <span className="block text-sm text-slate-600">{detail}</span>}
            </span>
            <span
                className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300'
                )}
            >
                {selected && <Check className="h-4 w-4" />}
            </span>
        </button>
    )
}

/** A Square item photo, or a soft placeholder when it has none. */
export function ItemImage({ url, className }: { url: string | null; className?: string }) {
    return url ? (
        <img src={url} alt="" className={cn('h-12 w-12 shrink-0 rounded-lg object-cover', className)} />
    ) : (
        <span
            className={cn('h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br from-violet-100 to-amber-100', className)}
        />
    )
}
