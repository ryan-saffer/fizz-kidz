import { ShoppingBag, Store } from 'lucide-react'

import { capitalise, getTerminalCheckoutStudios } from '@fizz-kidz/core'

import { useOrg } from '@session/use-org'
import { Button } from '@shared/components/ui/button'

import { PosDialog } from '../components/pos-dialog'
import { usePosStore } from '../state/pos-store'

/**
 * Selling our products on the studio's Square Terminal, in place of the Square Point of Sale app. A studio iPad sells
 * at its own studio; head office picks the studio.
 */
export function PosPage() {
    const { currentOrg, role } = useOrg()
    // super-admins can sell anywhere, to try it before a studio trials it
    const studios = getTerminalCheckoutStudios(currentOrg, import.meta.env.VITE_ENV, role === 'super-admin')
    const open = usePosStore((state) => state.open)

    return (
        <div className="twp min-h-[calc(100vh-4rem)] bg-slate-100 px-4 py-8 sm:px-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <header className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">
                        <ShoppingBag className="h-6 w-6 text-violet-700" />
                    </span>
                    <div>
                        <h1 className="font-lilita text-3xl font-normal text-slate-900">Sell products</h1>
                        <p className="text-slate-600">
                            Charge a customer for our kits on the studio&apos;s Square Terminal.
                        </p>
                    </div>
                </header>
                <section className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
                    {studios.length === 0 ? (
                        <p className="text-slate-600">Selling products isn&apos;t available at this studio yet.</p>
                    ) : studios.length === 1 ? (
                        <>
                            <p className="text-slate-600">
                                Selling at the <strong>{capitalise(studios[0])}</strong> studio.
                            </p>
                            <Button
                                variant="darkPurple"
                                className="h-14 px-10 text-base"
                                onClick={() => open(studios[0])}
                            >
                                <ShoppingBag className="mr-2 h-5 w-5" />
                                New sale
                            </Button>
                        </>
                    ) : (
                        <>
                            <p className="text-slate-600">Which studio is the sale at?</p>
                            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                                {studios.map((studio) => (
                                    <Button
                                        key={studio}
                                        variant="outline"
                                        className="h-14 text-base"
                                        onClick={() => open(studio)}
                                    >
                                        <Store className="mr-2 h-5 w-5 text-violet-700" />
                                        {capitalise(studio)}
                                    </Button>
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </div>
            <PosDialog />
        </div>
    )
}
