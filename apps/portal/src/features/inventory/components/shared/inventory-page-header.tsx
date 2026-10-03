import { cn } from '@shared/lib/tailwind'

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'blue' }) {
    return (
        <div className="inline-flex min-w-32 items-center gap-3 rounded-full bg-white px-4 py-2 text-slate-800 shadow-[0_6px_12px_rgba(15,23,42,0.08)] ring-1 ring-slate-200">
            <span className={cn('h-2.5 w-2.5 rounded-full', tone === 'cyan' ? 'bg-[#00c2e3]' : 'bg-[#007f93]')} />
            <span className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-500">{label}</span>
                <span className="text-base font-black text-slate-950">{value}</span>
            </span>
        </div>
    )
}

export function InventoryPageHeader({ itemCount, trackedCount }: { itemCount: number; trackedCount: number }) {
    return (
        <header className="relative isolate py-6 sm:py-8">
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="relative flex max-w-3xl flex-col gap-3">
                    <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200">
                        <span className="h-2 w-2 rounded-full bg-[#00c2e3]" />
                        Inventory
                    </span>
                    <h1 className="lilita m-0 bg-gradient-to-r from-[#007f93] via-[#00c2e3] to-[#4BC5D9] bg-clip-text text-3xl leading-tight text-transparent sm:text-5xl">
                        Studio stock
                    </h1>
                    <p className="m-0 max-w-2xl text-sm leading-relaxed text-slate-700 sm:text-base">
                        What each studio has on hand. Receive deliveries, count stock and see what is reserved for
                        upcoming parties.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <SummaryStat label="Items" value={itemCount} tone="cyan" />
                    <SummaryStat label="Tracked here" value={trackedCount} tone="blue" />
                </div>
            </div>
        </header>
    )
}
