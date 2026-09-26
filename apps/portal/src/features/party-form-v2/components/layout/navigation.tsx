import { useStore } from '@tanstack/react-form'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@shared/components/ui/button'

import { useIsCheckoutLocked, usePartyConfig, usePartyFormApi, usePartyFormStore } from '../../state/party-form-store'
import { calculateTotal, formatPrice } from '../../utils/display'
import { PrimaryButton } from '../common/primary-button'

/**
 * Back/Next along the bottom of each step. On wider screens it spans the viewport and sticks to its bottom edge,
 * showing a background only while content scrolls beneath it. On phones it sits at the end of the step.
 */
export function PartyNavigation() {
    const form = usePartyFormApi()
    const config = usePartyConfig()
    const isReview = usePartyFormStore((state) => state.steps[state.currentStep]?.key === 'review')
    const advancing = usePartyFormStore((state) => state.advancing)
    const locked = useIsCheckoutLocked()
    const total = useStore(form.store, (state) => calculateTotal(state.values, config))
    const back = () => usePartyFormStore.getState().goTo(usePartyFormStore.getState().currentStep - 1)
    return (
        <footer
            ref={observeStuck}
            className="z-10 mt-[26px] flex items-end justify-between gap-3.5 border-t border-transparent px-[calc(50vw_-_50%)] pb-[calc(max(18px,env(safe-area-inset-bottom))_+_1px)] pt-[18px] [margin-inline:calc(50%_-_50vw)] sm:sticky sm:bottom-[-1px] sm:mt-9 sm:items-center sm:transition-[background-color,border-color,box-shadow] sm:duration-200 sm:data-[stuck]:border-party-line sm:data-[stuck]:bg-[#fcfaf7e6] sm:data-[stuck]:shadow-[0_-6px_20px_#3024400d] sm:data-[stuck]:backdrop-blur-md"
        >
            <Button
                type="button"
                variant="ghost"
                className="gap-2 text-party-muted"
                onClick={back}
                disabled={advancing || locked}
            >
                <ArrowLeft size={16} aria-hidden="true" /> Back
            </Button>
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-[22px]">
                {total > 0 && !isReview && (
                    <span className="flex items-baseline gap-2 text-[11px] text-party-muted sm:flex-col sm:items-end sm:gap-0">
                        To pay today <strong className="text-[17px] text-party-ink">{formatPrice(total)}</strong>
                    </span>
                )}
                {!isReview && (
                    <PrimaryButton type="submit" disabled={advancing}>
                        Next <ArrowRight size={17} aria-hidden="true" />
                    </PrimaryButton>
                )}
            </div>
        </footer>
    )
}

/** Sticking with `bottom: -1px` leaves the bar 1px out of view, which is how we know it is stuck. */
function observeStuck(node: HTMLElement | null) {
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
        ([entry]) => node.toggleAttribute('data-stuck', entry.intersectionRatio < 1),
        { threshold: [1] }
    )
    observer.observe(node)
    return () => observer.disconnect()
}
