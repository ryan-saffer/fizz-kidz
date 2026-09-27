import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/lib/tailwind'

import { CHECKOUT_STEPS, useCheckoutStore } from '../state/checkout-store'
import { OrderSummary } from './order-summary'
import { FoodStep } from './steps/food-step'
import { PartyStep } from './steps/party-step'
import { ReviewStep } from './steps/review-step'

/** One step at a time, with the running total beside it for the customer to follow. */
export function CheckoutSteps() {
    const step = useCheckoutStore((state) => state.step)
    const goTo = useCheckoutStore((state) => state.goTo)
    const index = CHECKOUT_STEPS.findIndex((it) => it.key === step)

    return (
        <>
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                    <ol className="flex flex-wrap items-center gap-2">
                        {CHECKOUT_STEPS.map((it, i) => (
                            <li key={it.key} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-current={it.key === step ? 'step' : undefined}
                                    onClick={() => goTo(it.key)}
                                    className={cn(
                                        'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
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
                                {i < CHECKOUT_STEPS.length - 1 && <span className="h-px w-4 bg-slate-300" />}
                            </li>
                        ))}
                    </ol>
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="min-w-0">
                            {step === 'party' && <PartyStep />}
                            {step === 'food' && <FoodStep />}
                            {step === 'review' && <ReviewStep />}
                        </div>
                        {/* on narrow screens the customer sees what they're paying for before the charge button */}
                        <OrderSummary className={cn(step === 'review' && 'order-first lg:order-none')} />
                    </div>
                </div>
            </div>
            {step !== 'review' && (
                <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
                    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            className={cn(index === 0 && 'invisible')}
                            onClick={() => goTo(CHECKOUT_STEPS[index - 1].key)}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <Button
                            variant="darkPurple"
                            className="min-w-32"
                            onClick={() => goTo(CHECKOUT_STEPS[index + 1].key)}
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
