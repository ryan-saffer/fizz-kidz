import { AlertCircle, Loader2 } from 'lucide-react'

import { FullScreenHeader } from '@shared/components/full-screen-header'
import { Sheet, SheetContent } from '@shared/components/ui/sheet'

import type { ReactNode } from 'react'

/**
 * The full screen a terminal checkout opens in. While a charge is on the terminal it can't be closed, so the charge is
 * cancelled or finished first rather than left behind.
 */
export function TerminalCheckoutSheet({
    open,
    onClose,
    charging,
    title,
    description,
    children,
}: {
    open: boolean
    onClose: () => void
    charging: boolean
    title: string
    description: ReactNode
    children: ReactNode
}) {
    return (
        <Sheet open={open} onOpenChange={(open) => !open && !charging && onClose()}>
            <SheetContent
                side="bottom"
                className="twp top-0 flex h-[100dvh] flex-col gap-0 border-0 bg-slate-100 p-0 focus:outline-none"
                onOpenAutoFocus={(e) => e.preventDefault()}
                hideCloseBtn
            >
                <FullScreenHeader
                    className="max-w-5xl"
                    title={title}
                    description={description}
                    closeDisabled={charging}
                />
                {children}
            </SheetContent>
        </Sheet>
    )
}

export function CheckoutLoading() {
    return (
        <Centered>
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </Centered>
    )
}

/** Why the checkout can't go ahead, e.g. Square's prices didn't load. */
export function CheckoutProblem({ children }: { children: ReactNode }) {
    return (
        <Centered>
            <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-sm">
                <AlertCircle className="h-10 w-10 text-rose-500" />
                <p className="text-slate-700">{children}</p>
            </div>
        </Centered>
    )
}

function Centered({ children }: { children: ReactNode }) {
    return <div className="flex flex-1 items-center justify-center p-6">{children}</div>
}
