import { useStore } from '@tanstack/react-form'
import { Check } from 'lucide-react'

import { useIsCheckoutLocked, usePartyFormApi, usePartyFormStore } from '../../state/party-form-store'

export function PartyProgress() {
    const form = usePartyFormApi()
    const steps = usePartyFormStore((state) => state.steps)
    const current = usePartyFormStore((state) => state.currentStep)
    const advancing = usePartyFormStore((state) => state.advancing)
    const { goTo, advance, lastReachableStep } = usePartyFormStore.getState()
    const locked = useIsCheckoutLocked()
    // recalculated whenever the answers or their validation change
    const lastReachable = useStore(form.store, (state) => lastReachableStep(state.values))
    const disabled = advancing || locked
    return (
        <nav className="mx-auto mt-2.5 max-w-[860px] sm:mt-1.5" aria-label="Party form progress">
            <div className="mb-3 flex justify-between text-xs text-party-muted sm:hidden">
                <span className="font-semibold text-party-pink">{steps[current].label}</span>
                <span>
                    Step {current + 1} of {steps.length}
                </span>
            </div>
            <ol className="mb-[18px] hidden justify-between gap-[5px] sm:flex md:gap-3">
                {steps.map((step, index) => (
                    <li key={step.key}>
                        <button
                            type="button"
                            className="group flex items-center gap-1 text-[10px] text-party-muted aria-[current=step]:font-bold aria-[current=step]:text-party-pink md:gap-[7px] md:text-xs"
                            aria-current={index === current ? 'step' : undefined}
                            disabled={disabled || index === current || (index > current && index > lastReachable)}
                            onClick={() => (index < current ? goTo(index) : void advance(index))}
                        >
                            <span
                                className="grid h-6 w-6 place-items-center rounded-full border border-party-line text-[10px] group-enabled:border-[#ece1f2] group-enabled:bg-[#ece1f2] group-enabled:text-party-pink group-aria-[current=step]:border-party-pink group-aria-[current=step]:bg-party-pink group-aria-[current=step]:text-white"
                                aria-hidden="true"
                            >
                                {index < current ? <Check size={14} aria-hidden="true" /> : index + 1}
                            </span>
                            {step.label}
                        </button>
                    </li>
                ))}
            </ol>
            <div className="h-[3px] overflow-hidden rounded bg-[#e9e0eb]">
                <div
                    className="h-full bg-party-pink transition-[width] duration-300 ease-in-out"
                    style={{ width: `${((current + 1) / steps.length) * 100}%` }}
                />
            </div>
        </nav>
    )
}
