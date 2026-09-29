import { convertToModelMessages, isStepCount, streamText, toUIMessageStream, type UIMessage } from 'ai'
import { logger } from 'firebase-functions/v2'

import type { WebsiteChatModel } from '@fizz-kidz/core'

import { saveWebsiteChat } from './save-website-chat'
import { submitEnquiryTool } from './submit-enquiry-tool'
import { getWebsiteChatPageContext, WEBSITE_CHAT_INSTRUCTIONS } from './website-chat-instructions'

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
        instructions: [
            { role: 'system', content: WEBSITE_CHAT_INSTRUCTIONS },
            { role: 'system', content: getWebsiteChatPageContext({ pagePath, greeting }) },
        ],
        messages: await convertToModelMessages(messages, { tools }),
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
            return "Sorry, I'm not available right now. Try again soon."
        },
    })
}
