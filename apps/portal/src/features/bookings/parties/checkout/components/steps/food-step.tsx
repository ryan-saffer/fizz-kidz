import { formatCents } from '@fizz-kidz/core'

import { toggleAddition, useCheckoutStore } from '../../state/checkout-store'
import { OptionCard, StepSection } from '../step-section'

/** The food additions to charge, starting from what the parent ordered in their party form. */
export function FoodStep() {
    const config = useCheckoutStore((state) => state.config!)
    const additions = useCheckoutStore((state) => state.answers.additions)
    const setAnswers = useCheckoutStore((state) => state.setAnswers)

    return (
        <StepSection
            title="Food additions"
            description="These are what the parent ordered in their party form. Change them if something was added or left off."
        >
            {config.additions.length === 0 ? (
                <p className="text-sm text-slate-500">No food additions are offered at this studio.</p>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {config.additions.map((addition) => (
                        <OptionCard
                            key={addition.key}
                            selected={additions.includes(addition.key)}
                            onSelect={() => setAnswers({ additions: toggleAddition(additions, addition.key) })}
                            title={addition.name}
                            detail={formatCents(addition.priceCents)}
                            imageUrl={addition.imageUrl}
                        />
                    ))}
                </div>
            )}
        </StepSection>
    )
}
