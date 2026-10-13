import { CakeSlice, Check } from 'lucide-react'

import { OptionCard, StepSection } from '@features/terminal-checkout/components/step-section'
import { cn } from '@shared/lib/tailwind'

import { useCheckoutStore } from '../../state/checkout-store'

/**
 * Confirms a studio-stock cake (Geelong, Werribee) was used, and whether it was served in our cups and spoons and had
 * our candles, starting from the party form. It's not charged: the parent paid in the party form. What's confirmed
 * comes off the studio's stock once the party is paid.
 */
export function CakeStep() {
    const cake = useCheckoutStore((state) => state.config!.cake!)
    const answers = useCheckoutStore((state) => state.answers)
    const setAnswers = useCheckoutStore((state) => state.setAnswers)

    return (
        <StepSection title="Birthday cake" description="Confirm that this cake was used.">
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                <CakeSlice className="h-4 w-4 shrink-0" />
                Already paid in the party form. The cake isn&apos;t charged here.
            </p>
            <OptionCard
                selected={answers.cakeUsed}
                onSelect={() => setAnswers({ cakeUsed: !answers.cakeUsed })}
                title={cake.selection}
                detail="Cake used"
            />
            {(cake.serving || cake.candles) && (
                <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-slate-700">Add-ons</h4>
                    {cake.serving && (
                        <AddOn
                            selected={answers.cakeServingUsed}
                            onSelect={() => setAnswers({ cakeServingUsed: !answers.cakeServingUsed })}
                            name={cake.serving.supplies.join(' & ')}
                            ordered={cake.serving.ordered}
                        />
                    )}
                    {cake.candles && (
                        <AddOn
                            selected={answers.cakeCandlesUsed}
                            onSelect={() => setAnswers({ cakeCandlesUsed: !answers.cakeCandlesUsed })}
                            name={cake.candles.supplies.join(' & ')}
                            ordered={cake.candles.ordered}
                        />
                    )}
                </div>
            )}
        </StepSection>
    )
}

/** A small tick row for something used with the cake, under the cake itself. */
function AddOn({
    selected,
    onSelect,
    name,
    ordered,
}: {
    selected: boolean
    onSelect: () => void
    name: string
    /** Whether the parent chose it in the party form. */
    ordered: boolean
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                selected ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
            )}
        >
            <span
                className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2',
                    selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300'
                )}
            >
                {selected && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="flex-1 font-medium text-slate-900">{name}</span>
            <span className="text-xs text-slate-500">
                {ordered ? 'Chosen in the party form' : 'Not chosen in the party form'}
            </span>
        </button>
    )
}
