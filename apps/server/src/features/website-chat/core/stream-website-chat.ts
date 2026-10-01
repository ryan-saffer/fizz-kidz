import { convertToModelMessages, isStepCount, streamText, toUIMessageStream, type UIMessage } from 'ai'
import { logger } from 'firebase-functions/v2'

import type { WebsiteChatModel } from '@fizz-kidz/core'

import { saveWebsiteChat } from './save-website-chat'
import { submitEnquiryTool } from './submit-enquiry-tool'
import { getWebsiteChatPageContext, withContextNote, withRecentHistory } from './website-chat-context'
import { WEBSITE_CHAT_INSTRUCTIONS } from './website-chat-instructions'

import { logError } from '@/integrations/observability/log-error'

export const websiteChatTools = { submit_enquiry: submitEnquiryTool }

export async function streamWebsiteChat({
    chatId,
    messages,
    model,
    pagePath,
    greeting,
}: {
    chatId: string
    messages: UIMessage[]
    model: WebsiteChatModel
    pagePath?: string
    greeting?: string
}) {
    const tools = websiteChatTools
    const result = streamText({
        // Plain model IDs are routed through the Vercel AI Gateway using AI_GATEWAY_API_KEY.
        model,
        // Identical for every request, so providers can serve it from their prompt cache.
        instructions: WEBSITE_CHAT_INSTRUCTIONS,
        messages: withContextNote(
            await convertToModelMessages(withRecentHistory(messages), { tools }),
            getWebsiteChatPageContext({ pagePath, greeting })
        ),
        tools,
        // Lets the model reply after a tool call, e.g. to confirm an enquiry was sent.
        stopWhen: isStepCount(4),
        maxOutputTokens: 1000,
        // Chat replies need speed more than deep thinking. Models without reasoning ignore this.
        reasoning: 'low',
        providerOptions: { gateway: { caching: 'auto' } },
        onEnd: ({ totalUsage }) => {
            logger.info('Website chat usage', { model, pagePath, usage: totalUsage })
        },
    })

    return toUIMessageStream({
        stream: result.stream,
        tools,
        originalMessages: messages,
        onEnd: ({ messages: updatedMessages }) =>
            saveWebsiteChat({ id: chatId, messages: updatedMessages, model, pagePath }),
        onError: (error) => {
            logError('Website chat stream failed', error, { model, pagePath })
            return 'Oops, my fizz has gone a little flat! 🫧 Give me a moment and try again, or call the team on (03) 9059 8144.'
        },
    })
}
