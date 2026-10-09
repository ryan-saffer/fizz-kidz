import { z } from 'zod'

import { WebsiteChatIdSchema } from '@fizz-kidz/core'

import { authenticatedProcedure, router } from '@/app/trpc/trpc'
import {
    deleteWebsiteChatTranscripts,
    getWebsiteChatTranscript,
    listWebsiteChatTranscripts,
} from '@/features/website-chat/core/website-chat-transcripts'

export const websiteChatsRouter = router({
    list: authenticatedProcedure.query(({ ctx }) => listWebsiteChatTranscripts(ctx.uid)),
    get: authenticatedProcedure
        .input(z.object({ id: WebsiteChatIdSchema }))
        .query(({ input, ctx }) => getWebsiteChatTranscript(input.id, ctx.uid)),
    delete: authenticatedProcedure
        .input(z.object({ ids: z.array(WebsiteChatIdSchema).min(1).max(500) }))
        .mutation(({ input, ctx }) => deleteWebsiteChatTranscripts(input.ids, ctx.uid)),
})
