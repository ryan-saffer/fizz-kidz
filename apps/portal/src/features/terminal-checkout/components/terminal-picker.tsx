import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, MonitorSmartphone } from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'

import { useTRPC } from '@integrations/trpc'
import type { AppRouter } from '@server/app/trpc/app.trpc'
import { Button } from '@shared/components/ui/button'

import { useCheckoutStudio, useTerminalCheckout } from '../state/terminal-checkout-context'
import { OptionCard, StepSection } from './step-section'

import type { inferRouterOutputs } from '@trpc/server'

type Pairing = inferRouterOutputs<AppRouter>['payments']['pairTerminal']

/**
 * The studio's Square Terminal: the one paired with the portal at its Square location, used on any iPad. With none
 * paired, staff pair it here once. Several only happens in the sandbox, whose test devices each act out a result.
 */
export function TerminalPicker() {
    const trpc = useTRPC()
    const studio = useCheckoutStudio()
    const terminals = useQuery(trpc.payments.listTerminals.queryOptions({ studio }))
    const terminal = useTerminalCheckout((state) => state.terminal)
    const setTerminal = useTerminalCheckout((state) => state.setTerminal)

    if (terminals.isPending)
        return (
            <StepSection title="Terminal">
                <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Finding the studio&apos;s terminal…
                </p>
            </StepSection>
        )
    if (terminals.isError)
        return (
            <StepSection title="Terminal">
                <p className="text-sm text-rose-700">Unable to find the studio&apos;s terminal. Please try again.</p>
            </StepSection>
        )
    if (terminals.data.length === 0)
        return (
            <StepSection
                title="Pair the studio's terminal"
                description="No terminal is paired at this studio yet. Once it's paired, every charge here uses it."
            >
                {/* the refetched list has the new terminal, which is then used automatically */}
                <PairTerminal onPaired={() => void terminals.refetch()} />
            </StepSection>
        )
    if (terminals.data.length === 1)
        return (
            <StepSection title="Terminal">
                <div className="flex items-center gap-3">
                    <MonitorSmartphone className="h-6 w-6 text-violet-700" />
                    <span className="font-medium text-slate-900">{terminals.data[0].name}</span>
                </div>
            </StepSection>
        )
    return (
        <StepSection title="Which terminal?" description="Square's sandbox has a test terminal for each result.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {terminals.data.map((option) => (
                    <OptionCard
                        key={option.deviceId}
                        selected={terminal?.deviceId === option.deviceId}
                        onSelect={() => setTerminal(option)}
                        title={option.name}
                    />
                ))}
            </div>
        </StepSection>
    )
}

function PairTerminal({ onPaired }: { onPaired: () => void }) {
    const trpc = useTRPC()
    const studio = useCheckoutStudio()
    const pair = useMutation(trpc.payments.pairTerminal.mutationOptions())
    const { mutateAsync: checkPairing } = useMutation(trpc.payments.getTerminalPairing.mutationOptions())
    const [pairingState, setPairingState] = useState<Pairing | null>(null)

    // the code is valid for five minutes; check until the terminal signs in with it
    const deviceCodeId = pairingState?.status === 'UNPAIRED' ? pairingState.deviceCodeId : null
    const handlePairing = useEffectEvent((result: Pairing) => {
        if (result.status === 'PAIRED') onPaired()
        else setPairingState(result)
    })
    useEffect(() => {
        if (!deviceCodeId) return
        const interval = setInterval(async () => {
            const result = await checkPairing({ deviceCodeId }).catch(() => null)
            if (result) handlePairing(result)
        }, 3000)
        return () => clearInterval(interval)
    }, [deviceCodeId, checkPairing])

    if (pairingState?.status === 'UNPAIRED')
        return (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-violet-50 p-5 text-center ring-1 ring-violet-100">
                <p className="text-sm text-slate-700">
                    On the terminal, sign out if needed, then choose <strong>Device code</strong> on the sign-in screen
                    and enter:
                </p>
                <p className="font-mono text-4xl font-bold tracking-[0.3em] text-violet-900">{pairingState.code}</p>
                <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Waiting for the terminal (the code lasts 5 minutes)
                </p>
                <Button variant="ghost" size="sm" onClick={() => setPairingState(null)}>
                    Cancel
                </Button>
            </div>
        )

    return (
        <div className="flex flex-col items-start gap-2">
            <Button
                variant="darkPurple"
                disabled={pair.isPending}
                onClick={async () => setPairingState(await pair.mutateAsync({ studio }).catch(() => null))}
            >
                {pair.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Get code
            </Button>
            {pair.error && <p className="text-sm text-rose-700">{pair.error.message}</p>}
            {pairingState?.status === 'EXPIRED' && (
                <p className="text-sm text-amber-700">The code expired before the terminal used it. Get a new one.</p>
            )}
        </div>
    )
}
