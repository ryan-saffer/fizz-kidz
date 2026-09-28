import { X } from 'lucide-react'

import { Button } from '@shared/components/ui/button'
import { SheetClose, SheetDescription, SheetHeader, SheetTitle } from '@shared/components/ui/sheet'
import { cn } from '@shared/lib/tailwind'

import type { ReactNode } from 'react'

/** The header bar of a full screen dialog, with the close button beside the title rather than in the corner. */
export function FullScreenHeader({
    title,
    description,
    className,
    closeDisabled,
}: {
    title: string
    description: ReactNode
    /** Matches the dialog's content width, e.g. `max-w-3xl`. */
    className: string
    closeDisabled?: boolean
}) {
    return (
        <SheetHeader className="border-b border-slate-200 bg-white px-4 py-4 text-left sm:px-6">
            <div className={cn('mx-auto flex w-full items-center gap-3', className)}>
                <div className="min-w-0 flex-1">
                    <SheetTitle className="font-lilita text-2xl font-normal">{title}</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </div>
                <SheetClose asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0 rounded-full"
                        aria-label="Close"
                        disabled={closeDisabled}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </SheetClose>
            </div>
        </SheetHeader>
    )
}
