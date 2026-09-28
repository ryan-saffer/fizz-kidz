import { Minus, Plus } from 'lucide-react'

import { formatCents } from '@fizz-kidz/core'

import { ItemImage, StepSection } from '@features/terminal-checkout/components/step-section'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/lib/tailwind'

import { MAX_QUANTITY, setQuantity, usePosStore } from '../state/pos-store'

/** The products the studio sells, each with how many the customer is buying. */
export function ProductsStep() {
    const products = usePosStore((state) => state.config!.products)
    const items = usePosStore((state) => state.answers.items)
    const setAnswers = usePosStore((state) => state.setAnswers)
    const quantityOf = (variationId: string) => items.find((item) => item.variationId === variationId)?.quantity ?? 0
    const change = (variationId: string, quantity: number) =>
        setAnswers({ items: setQuantity(items, variationId, quantity) })

    return (
        <StepSection title="Products" description="Tap a product to add it, then set how many.">
            {products.length === 0 ? (
                <p className="text-sm text-slate-500">No products are sold at this studio in Square.</p>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {products.map((product) => {
                        const quantity = quantityOf(product.variationId)
                        return (
                            <div
                                key={product.variationId}
                                className={cn(
                                    'flex flex-col gap-3 rounded-xl border-2 p-3 transition-colors',
                                    quantity > 0 ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white'
                                )}
                            >
                                <button
                                    type="button"
                                    className="flex min-w-0 items-center gap-3 text-left"
                                    aria-label={`Add ${product.name}`}
                                    disabled={quantity >= MAX_QUANTITY}
                                    onClick={() => change(product.variationId, quantity + 1)}
                                >
                                    <ItemImage url={product.imageUrl} className="h-16 w-16" />
                                    <span className="min-w-0">
                                        <span className="block font-semibold text-slate-900">{product.name}</span>
                                        <span className="block text-sm text-slate-600">
                                            {formatCents(product.priceCents)}
                                        </span>
                                    </span>
                                </button>
                                {/* the same height either way, so cards don't jump as products are added */}
                                <div className="flex h-10 items-center justify-end gap-1">
                                    {quantity === 0 ? (
                                        <Button
                                            variant="outline"
                                            className="h-10"
                                            tabIndex={-1}
                                            aria-hidden
                                            onClick={() => change(product.variationId, 1)}
                                        >
                                            <Plus className="mr-1 h-4 w-4" />
                                            Add
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 rounded-lg"
                                                aria-label={`One less ${product.name}`}
                                                onClick={() => change(product.variationId, quantity - 1)}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span
                                                className="w-10 text-center text-lg font-bold tabular-nums"
                                                aria-label={`${quantity} ${product.name}`}
                                            >
                                                {quantity}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 rounded-lg"
                                                aria-label={`One more ${product.name}`}
                                                disabled={quantity >= MAX_QUANTITY}
                                                onClick={() => change(product.variationId, quantity + 1)}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </StepSection>
    )
}
