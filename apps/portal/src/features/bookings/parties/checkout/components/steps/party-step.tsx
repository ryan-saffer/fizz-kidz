import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { formatCents } from '@fizz-kidz/core'

import { OptionCard, StepSection } from '@features/terminal-checkout/components/step-section'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'

import { useCheckoutStore } from '../../state/checkout-store'

/** Confirms how the party is charged: its length, food package and the children who came. */
export function PartyStep() {
    const config = useCheckoutStore((state) => state.config!)
    const answers = useCheckoutStore((state) => state.answers)
    const setAnswers = useCheckoutStore((state) => state.setAnswers)
    const priceFor = (partyLength: '1.5' | '2', includesFood: boolean) =>
        config.partyPrices.find((it) => it.partyLength === partyLength && it.includesFood === includesFood)

    return (
        <div className="flex flex-col gap-4">
            <StepSection title="Party length">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(['1.5', '2'] as const).map((partyLength) => (
                        <OptionCard
                            key={partyLength}
                            selected={answers.partyLength === partyLength}
                            onSelect={() => setAnswers({ partyLength })}
                            title={`${partyLength} hours`}
                        />
                    ))}
                </div>
            </StepSection>

            {/* the price per child depends on both, so it's shown once the length is chosen */}
            <StepSection title="Food package" description={`Price per child for a ${answers.partyLength} hour party.`}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[true, false].map((includesFood) => (
                        <OptionCard
                            key={String(includesFood)}
                            selected={answers.includesFood === includesFood}
                            onSelect={() => setAnswers({ includesFood })}
                            title={includesFood ? 'Food package included' : 'Self-catered'}
                            detail={`${formatCents(priceFor(answers.partyLength, includesFood)?.priceCents ?? 0)} per child`}
                        />
                    ))}
                </div>
            </StepSection>

            <StepSection
                title="Children who came"
                description={
                    <>
                        Parties are charged for at least {config.minChildren} children.
                        {config.bookedChildren && ` Booked for ${config.bookedChildren}.`}
                    </>
                }
            >
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-xl"
                        aria-label="One less child"
                        disabled={answers.childrenCount <= 1}
                        onClick={() => setAnswers({ childrenCount: answers.childrenCount - 1 })}
                    >
                        <Minus className="h-5 w-5" />
                    </Button>
                    <ChildrenInput
                        count={answers.childrenCount}
                        onChange={(childrenCount) => setAnswers({ childrenCount })}
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-xl"
                        aria-label="One more child"
                        onClick={() => setAnswers({ childrenCount: answers.childrenCount + 1 })}
                    >
                        <Plus className="h-5 w-5" />
                    </Button>
                    {answers.childrenCount < config.minChildren && (
                        <p className="text-sm font-medium text-amber-700">Charged as {config.minChildren}</p>
                    )}
                </div>
            </StepSection>
        </div>
    )
}

/**
 * The number typed while the field has focus. It can be cleared to type a new number; each valid number counts
 * straight away, and leaving it empty puts back the last one.
 */
function ChildrenInput({ count, onChange }: { count: number; onChange: (count: number) => void }) {
    const [draft, setDraft] = useState<string | null>(null)
    return (
        <Input
            aria-label="Children who came"
            inputMode="numeric"
            className="h-14 w-24 rounded-xl text-center text-2xl font-bold tabular-nums"
            value={draft ?? String(count)}
            onFocus={(e) => {
                setDraft(String(count))
                // typing replaces the number rather than adding to it
                e.currentTarget.select()
            }}
            onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
                setDraft(digits)
                const typed = parseInt(digits, 10)
                if (typed > 0) onChange(Math.min(typed, 200))
            }}
            onBlur={() => setDraft(null)}
        />
    )
}
