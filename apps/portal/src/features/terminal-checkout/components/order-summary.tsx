import { Loader2, ReceiptText } from 'lucide-react'

import { formatCents } from '@fizz-kidz/core'

import { cn } from '@shared/lib/tailwind'

import { useTerminalCheckout } from '../state/terminal-checkout-context'
import { REVIEW_STEP } from '../state/terminal-checkout-store'

import type { ReactNode } from 'react'

/** A line of the estimate, from the checkout's own copy of Square's prices. */
export type EstimateLine = { key: string; label: string; detail?: ReactNode; amountCents: number }

/**
 * How the total is made up, for staff to show the customer. It's an estimate from Square's prices while editing, and
 * Square's own priced order on the review step.
 */
export function OrderSummary({ estimate, className }: { estimate: EstimateLine[]; className?: string }) {
    const summary = useTerminalCheckout((state) => state.summary)
    const preparing = useTerminalCheckout((state) => state.preparing)
    const onReview = useTerminalCheckout((state) => state.step === REVIEW_STEP)

    return (
        <aside
            className={cn(
                'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-0',
                className
            )}
        >
            <header className="flex items-center gap-2 border-b border-violet-100 bg-violet-50 px-4 py-3">
                <ReceiptText className="h-5 w-5 text-violet-700" />
                <h3 className="flex-1 font-bold text-violet-950">Order summary</h3>
                {preparing && <Loader2 className="h-4 w-4 animate-spin text-violet-700" />}
            </header>
            {onReview && summary ? (
                <div className="flex flex-col gap-1 p-4">
                    {summary.items.map((item, index) => (
                        <Line key={index} label={item.label} amount={formatCents(item.amountCents)} />
                    ))}
                    {summary.orderDiscountCents > 0 && (
                        <Line label="Discount" amount={`−${formatCents(summary.orderDiscountCents)}`} tone="discount" />
                    )}
                    <Total label="Total" cents={summary.totalCents} />
                    {summary.giftCardCents > 0 && (
                        <>
                            <Line
                                label={`Gift card ending ${summary.giftCardLast4}`}
                                amount={`−${formatCents(summary.giftCardCents)}`}
                                tone="discount"
                            />
                            <Total label="To pay on the terminal" cents={summary.cardCents} />
                        </>
                    )}
                </div>
            ) : (
                <Estimate lines={estimate} faded={onReview} />
            )}
            {!onReview && (
                <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    Square confirms the final price on the review step.
                </p>
            )}
            {onReview && !summary && !preparing && (
                <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    Waiting for Square&apos;s price.
                </p>
            )}
        </aside>
    )
}

function Estimate({ lines, faded }: { lines: EstimateLine[]; faded: boolean }) {
    const discountCents = useTerminalCheckout((state) => state.answers.discountCents)
    const itemsCents = lines.reduce((sum, line) => sum + line.amountCents, 0)
    return (
        <div className={cn('flex flex-col gap-1 p-4', faded && 'opacity-60')}>
            {lines.length === 0 && <p className="py-1 text-sm text-slate-500">Nothing to charge yet.</p>}
            {lines.map((line) => (
                <Line key={line.key} label={line.label} detail={line.detail} amount={formatCents(line.amountCents)} />
            ))}
            {discountCents > 0 && <Line label="Discount" amount={`−${formatCents(discountCents)}`} tone="discount" />}
            <Total label="Estimated total" cents={Math.max(itemsCents - discountCents, 0)} />
        </div>
    )
}

function Line({
    label,
    detail,
    amount,
    tone,
}: {
    label: string
    detail?: ReactNode
    amount: string
    tone?: 'discount'
}) {
    return (
        <div className="flex items-start justify-between gap-3 py-1 text-sm">
            <span className="min-w-0">
                <span className={cn('block text-slate-800', tone === 'discount' && 'text-emerald-700')}>{label}</span>
                {detail && <span className="block text-xs text-slate-500">{detail}</span>}
            </span>
            <span
                className={cn(
                    'shrink-0 font-medium tabular-nums text-slate-900',
                    tone === 'discount' && 'text-emerald-700'
                )}
            >
                {amount}
            </span>
        </div>
    )
}

function Total({ label, cents }: { label: string; cents: number }) {
    return (
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
            <span className="font-semibold text-slate-900">{label}</span>
            <span className="text-2xl font-bold tabular-nums text-slate-900">{formatCents(cents)}</span>
        </div>
    )
}
