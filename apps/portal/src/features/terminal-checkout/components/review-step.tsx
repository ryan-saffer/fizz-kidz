import { AlertCircle, ArrowLeft, CreditCard, Gift, Loader2, Percent, X } from 'lucide-react'
import { useState } from 'react'

import { formatCents } from '@fizz-kidz/core'

import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'

import { useTerminalCheckout } from '../state/terminal-checkout-context'
import { StepSection } from './step-section'
import { TerminalPicker } from './terminal-picker'

/** Square's price is beside this step. Staff add a discount or gift card if needed, then charge the terminal. */
export function ReviewStep() {
    const summary = useTerminalCheckout((state) => state.summary)
    const preparing = useTerminalCheckout((state) => state.preparing)
    const terminal = useTerminalCheckout((state) => state.terminal)
    const error = useTerminalCheckout((state) => state.error)
    const goTo = useTerminalCheckout((state) => state.goTo)
    const previousStep = useTerminalCheckout((state) => state.steps[state.steps.length - 2].key)
    const charge = useTerminalCheckout((state) => state.charge)

    return (
        <div className="flex flex-col gap-4">
            <TerminalPicker />
            <StepSection
                title="Adjustments"
                description="Only if the customer has a gift card, or we're offering a discount."
            >
                <div className="flex flex-col gap-3">
                    <GiftCard />
                    <Discount />
                </div>
            </StepSection>
            {error && (
                <p
                    role="alert"
                    className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="outline" onClick={() => goTo(previousStep)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <Button
                    variant="darkPurple"
                    className="h-14 px-8 text-base"
                    disabled={!summary || preparing || !terminal}
                    onClick={() => void charge()}
                >
                    {preparing ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                        <CreditCard className="mr-2 h-5 w-5" />
                    )}
                    {!summary || summary.cardCents > 0
                        ? `Charge ${summary ? formatCents(summary.cardCents) : ''} on terminal`
                        : summary.giftCardCents > 0
                          ? 'Pay with gift card'
                          : 'Complete at no charge'}
                </Button>
            </div>
        </div>
    )
}

function GiftCard() {
    const applied = useTerminalCheckout((state) => state.answers.giftCardNumber)
    const setAnswers = useTerminalCheckout((state) => state.setAnswers)
    const [open, setOpen] = useState(false)
    const [number, setNumber] = useState('')

    if (applied)
        return (
            <Applied icon={Gift} onRemove={() => setAnswers({ giftCardNumber: '' })}>
                Gift card ending {applied.slice(-4)}
            </Applied>
        )
    if (!open) return <Reveal icon={Gift} label="Use a gift card" onClick={() => setOpen(true)} />
    return (
        <Entry
            label="Gift card number"
            value={number}
            inputMode="numeric"
            onChange={setNumber}
            valid={number.trim().length > 0}
            onApply={() => setAnswers({ giftCardNumber: number.replace(/\s/g, '') })}
            onCancel={() => setOpen(false)}
        />
    )
}

function Discount() {
    const applied = useTerminalCheckout((state) => state.answers)
    const setAnswers = useTerminalCheckout((state) => state.setAnswers)
    const [open, setOpen] = useState(false)
    const [amount, setAmount] = useState('')
    const [reason, setReason] = useState('')
    const cents = Math.round(parseFloat(amount) * 100) || 0
    const valid = cents > 0 && reason.trim().length > 0

    if (applied.discountCents > 0)
        return (
            <Applied icon={Percent} onRemove={() => setAnswers({ discountCents: 0, discountReason: '' })}>
                {formatCents(applied.discountCents)} discount
                <span className="block text-xs font-normal text-emerald-700">{applied.discountReason}</span>
            </Applied>
        )
    if (!open) return <Reveal icon={Percent} label="Add a discount" onClick={() => setOpen(true)} />
    return (
        <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
                e.preventDefault()
                if (valid) setAnswers({ discountCents: cents, discountReason: reason.trim() })
            }}
        >
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <Input
                    aria-label="Discount in dollars"
                    placeholder="Discount in dollars"
                    inputMode="decimal"
                    autoComplete="off"
                    className="pl-7"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
            </div>
            <Input
                aria-label="Reason for the discount"
                placeholder="Reason, e.g. the slime activity ran short or a damaged box"
                autoComplete="off"
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-slate-500">The reason is kept for us and isn&apos;t shown to the customer.</p>
            <div className="flex gap-2">
                <Button type="submit" variant="outline" disabled={!valid}>
                    Apply
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}

function Reveal({ icon: Icon, label, onClick }: { icon: typeof Gift; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 self-start rounded-lg px-1 py-1 text-sm font-medium text-violet-700 hover:underline"
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    )
}

function Applied({
    icon: Icon,
    onRemove,
    children,
}: {
    icon: typeof Gift
    onRemove: () => void
    children: React.ReactNode
}) {
    return (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            <Icon className="h-4 w-4" />
            <span className="flex-1">{children}</span>
            <Button variant="ghost" size="sm" className="h-8" onClick={onRemove}>
                <X className="mr-1 h-4 w-4" />
                Remove
            </Button>
        </div>
    )
}

function Entry({
    label,
    value,
    inputMode,
    prefix,
    onChange,
    valid,
    onApply,
    onCancel,
}: {
    label: string
    value: string
    inputMode: 'numeric' | 'decimal'
    prefix?: string
    onChange: (value: string) => void
    valid: boolean
    onApply: () => void
    onCancel: () => void
}) {
    return (
        <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
                e.preventDefault()
                if (valid) onApply()
            }}
        >
            <div className="relative min-w-0 flex-1">
                {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{prefix}</span>}
                <Input
                    aria-label={label}
                    placeholder={label}
                    inputMode={inputMode}
                    autoComplete="off"
                    className={prefix ? 'pl-7' : undefined}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
            <Button type="submit" variant="outline" disabled={!valid}>
                Apply
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
            </Button>
        </form>
    )
}
