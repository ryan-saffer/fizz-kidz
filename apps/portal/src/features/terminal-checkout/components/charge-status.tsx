import { AlertTriangle, CheckCircle2, Loader2, MonitorSmartphone, Pencil, Plus, RotateCw } from 'lucide-react'

import { formatCents } from '@fizz-kidz/core'

import { Button } from '@shared/components/ui/button'

import { useTerminalCheckout } from '../state/terminal-checkout-context'

import type { ReactNode } from 'react'

/**
 * The charge once it's sent: waiting on the terminal, paid, or not completed. `paidMessage` tells staff how the
 * customer gets their receipt; `startOverLabel` offers another charge straight after, e.g. the next customer's sale.
 */
export function ChargeStatus({ paidMessage, startOverLabel }: { paidMessage: ReactNode; startOverLabel?: string }) {
    const stage = useTerminalCheckout((state) => state.stage)
    return (
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
            {stage === 'charging' && <Charging />}
            {stage === 'paid' && <Paid message={paidMessage} startOverLabel={startOverLabel} />}
            {stage === 'canceled' && <NotCompleted />}
        </div>
    )
}

function Charging() {
    const summary = useTerminalCheckout((state) => state.summary)
    const terminal = useTerminalCheckout((state) => state.terminal)
    const cancelling = useTerminalCheckout((state) => state.cancelling)
    const onTerminal = useTerminalCheckout((state) => state.onTerminal)
    const cancel = useTerminalCheckout((state) => state.cancel)
    const error = useTerminalCheckout((state) => state.error)

    return (
        <Panel
            icon={
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-violet-100">
                    <span className="absolute inset-0 animate-ping rounded-full bg-violet-200 opacity-60 motion-reduce:animate-none" />
                    <MonitorSmartphone className="relative h-9 w-9 text-violet-700" />
                </span>
            }
            title={summary ? `Charging ${formatCents(summary.cardCents)}` : 'Charging'}
        >
            <p className="text-slate-600">
                Ask the customer to tap, insert or swipe their card on{' '}
                <strong>{terminal?.name ?? 'the terminal'}</strong>.
            </p>
            {summary && summary.giftCardCents > 0 && (
                <p className="text-sm text-slate-500">
                    {formatCents(summary.giftCardCents)} comes off their gift card when the payment goes through.
                </p>
            )}
            <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Keep this screen open until it finishes.
            </p>
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <Button variant="outline" disabled={cancelling || !onTerminal} onClick={() => void cancel()}>
                {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel charge
            </Button>
        </Panel>
    )
}

function Paid({ message, startOverLabel }: { message: ReactNode; startOverLabel?: string }) {
    const summary = useTerminalCheckout((state) => state.summary)
    const receiptUrl = useTerminalCheckout((state) => state.receiptUrl)
    const close = useTerminalCheckout((state) => state.close)
    const startOver = useTerminalCheckout((state) => state.startOver)

    return (
        <Panel icon={<CheckCircle2 className="h-20 w-20 text-emerald-500" />} title="Payment received">
            {summary && (
                <p className="text-3xl font-bold tabular-nums text-slate-900">{formatCents(summary.totalCents)}</p>
            )}
            <p className="text-slate-600">{message}</p>
            {receiptUrl && (
                <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-violet-700 hover:underline"
                >
                    View the Square receipt
                </a>
            )}
            <div className="flex flex-wrap justify-center gap-2">
                {startOverLabel && (
                    <Button variant="darkPurple" className="min-w-40" onClick={startOver}>
                        <Plus className="mr-2 h-4 w-4" />
                        {startOverLabel}
                    </Button>
                )}
                <Button variant={startOverLabel ? 'outline' : 'darkPurple'} className="min-w-40" onClick={close}>
                    Done
                </Button>
            </div>
        </Panel>
    )
}

function NotCompleted() {
    const error = useTerminalCheckout((state) => state.error)
    const unclear = useTerminalCheckout((state) => state.unclear)
    const resend = useTerminalCheckout((state) => state.resend)
    const edit = useTerminalCheckout((state) => state.edit)
    const close = useTerminalCheckout((state) => state.close)

    return (
        <Panel icon={<AlertTriangle className="h-20 w-20 text-amber-500" />} title="The payment didn't go through">
            <p className="text-slate-600">{error || 'The charge was cancelled.'}</p>
            {unclear ? (
                <p className="text-sm font-medium text-amber-700">
                    It may still have gone through. Check the payment in Square before sending it again.
                </p>
            ) : (
                <p className="text-sm text-slate-500">Nothing was charged.</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
                <Button variant="darkPurple" onClick={() => void resend()}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    Send to terminal again
                </Button>
                <Button variant="outline" onClick={edit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit the charge
                </Button>
                <Button variant="ghost" onClick={close}>
                    Close
                </Button>
            </div>
        </Panel>
    )
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
            {icon}
            <h3 className="font-lilita text-3xl font-normal text-slate-900">{title}</h3>
            {children}
        </div>
    )
}
