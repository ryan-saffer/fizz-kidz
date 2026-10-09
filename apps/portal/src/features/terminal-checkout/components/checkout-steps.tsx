import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/lib/tailwind'

import { useTerminalCheckout } from '../state/terminal-checkout-context'
import { REVIEW_STEP } from '../state/terminal-checkout-store'
import { OrderSummary, type EstimateLine } from './order-summary'
import { ReviewStep } from './review-step'

import type { ReactNode } from 'react'

/**
 * One step at a time, with the running total beside it for the customer to follow. The checkout renders its own steps;
 * the review step, where the charge is sent, is the same for every checkout. `canContinue` holds staff on a step
 * until it's filled in, e.g. with no products chosen.
 */
export function CheckoutSteps({
    renderStep,
    estimate,
    canContinue = true,
}: {
    renderStep: (step: string) => ReactNode
    estimate: EstimateLine[]
    canContinue?: boolean
}) {
    const steps = useTerminalCheckout((state) => state.steps)
    const step = useTerminalCheckout((state) => state.step)
    const goTo = useTerminalCheckout((state) => state.goTo)
    const index = steps.findIndex((it) => it.key === step)

    return (
        <>
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                    <ol className="flex flex-wrap items-center gap-2">
                        {steps.map((it, i) => (
                            <li key={it.key} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-current={it.key === step ? 'step' : undefined}
                                    // later steps wait until this one is filled in
                                    disabled={i > index && !canContinue}
                                    onClick={() => goTo(it.key)}
                                    className={cn(
                                        'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50',
                                        it.key === step
                                            ? 'bg-violet-600 text-white'
                                            : i < index
                                              ? 'bg-violet-100 text-violet-800'
                                              : 'bg-white text-slate-500 ring-1 ring-slate-200'
                                    )}
                                >
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs">
                                        {i < index ? <Check className="h-3.5 w-3.5" /> : i + 1}
                                    </span>
                                    {it.label}
                                </button>
                                {i < steps.length - 1 && <span className="h-px w-4 bg-slate-300" />}
                            </li>
                        ))}
                    </ol>
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="min-w-0">{step === REVIEW_STEP ? <ReviewStep /> : renderStep(step)}</div>
                        {/* on narrow screens the customer sees what they're paying for before the charge button */}
                        <OrderSummary
                            estimate={estimate}
                            className={cn(step === REVIEW_STEP && 'order-first lg:order-none')}
                        />
                    </div>
                </div>
            </div>
            {step !== REVIEW_STEP && (
                <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
                    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            className={cn(index === 0 && 'invisible')}
                            onClick={() => goTo(steps[index - 1].key)}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <Button
                            variant="darkPurple"
                            className="min-w-32"
                            disabled={!canContinue}
                            onClick={() => goTo(steps[index + 1].key)}
                        >
                            Next
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}
