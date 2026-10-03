import { AlertTriangle, Info } from 'lucide-react'

import { cn } from '@shared/lib/tailwind'

import type { ReactNode } from 'react'

export function InventoryNotice({ tone, children }: { tone: 'info' | 'warning' | 'danger'; children: ReactNode }) {
    const Icon = tone === 'info' ? Info : AlertTriangle

    return (
        <div
            className={cn(
                'flex gap-3 rounded-xl p-3 text-sm leading-relaxed ring-1',
                tone === 'info' && 'bg-sky-50 text-sky-900 ring-sky-200',
                tone === 'warning' && 'bg-amber-50 text-amber-900 ring-amber-200',
                tone === 'danger' && 'bg-red-50 text-red-900 ring-red-200'
            )}
        >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{children}</div>
        </div>
    )
}
