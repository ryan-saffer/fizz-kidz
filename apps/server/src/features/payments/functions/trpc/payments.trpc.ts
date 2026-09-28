import { z } from 'zod'

import { STUDIOS, type Studio } from '@fizz-kidz/core'

import { authenticatedProcedure, router } from '@/app/trpc/trpc'
import { getTerminalPairing, listStudioTerminals, pairStudioTerminal } from '@/features/payments/core/terminals'

const studio = z.custom<Studio>((value) => typeof value === 'string' && STUDIOS.includes(value as Studio))

/** The studios' Square Terminals, shared by party checkout and product sales. */
export const paymentsRouter = router({
    listTerminals: authenticatedProcedure
        .input(z.object({ studio }))
        .query(({ input }) => listStudioTerminals(input.studio)),
    pairTerminal: authenticatedProcedure
        .input(z.object({ studio }))
        .mutation(({ input }) => pairStudioTerminal(input.studio)),
    getTerminalPairing: authenticatedProcedure
        .input(z.object({ deviceCodeId: z.string().min(1) }))
        .mutation(({ input }) => getTerminalPairing(input.deviceCodeId)),
})
