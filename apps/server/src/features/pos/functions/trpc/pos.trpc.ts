import { z } from 'zod'

import { preparePosSchema, posTerminalCheckoutSchema, startPosSchema, STUDIOS, type Studio } from '@fizz-kidz/core'

import { authenticatedProcedure, router } from '@/app/trpc/trpc'
import { cancelPos, getPosStatus, startPos } from '@/features/pos/core/charge-pos'
import { getPos } from '@/features/pos/core/get-pos'
import { preparePos } from '@/features/pos/core/prepare-pos'

const studio = z.custom<Studio>((value) => typeof value === 'string' && STUDIOS.includes(value as Studio))

export const posRouter = router({
    getPos: authenticatedProcedure.input(z.object({ studio })).query(({ input, ctx }) => getPos(input.studio, ctx.uid)),
    preparePos: authenticatedProcedure.input(preparePosSchema).mutation(({ input, ctx }) => preparePos(input, ctx.uid)),
    startPos: authenticatedProcedure.input(startPosSchema).mutation(({ input, ctx }) => startPos(input, ctx.uid)),
    getPosStatus: authenticatedProcedure.input(posTerminalCheckoutSchema).mutation(({ input }) => getPosStatus(input)),
    cancelPos: authenticatedProcedure.input(posTerminalCheckoutSchema).mutation(({ input }) => cancelPos(input)),
})
