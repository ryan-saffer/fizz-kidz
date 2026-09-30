import { pipeUIMessageStreamToResponse, safeValidateUIMessages } from 'ai'
import express from 'express'
import { z } from 'zod'

import {
    DEFAULT_WEBSITE_CHAT_MODEL,
    WEBSITE_CHAT_MAX_MESSAGE_LENGTH,
    WEBSITE_CHAT_MAX_MESSAGES,
    WebsiteChatIdSchema,
    WebsiteChatModelSchema,
} from '@fizz-kidz/core'

import { streamWebsiteChat, websiteChatTools } from '../../core/stream-website-chat'

import { env } from '@/app/init/firebase'
import { logError } from '@/integrations/observability/log-error'

const WebsiteChatRequestSchema = z.object({
    id: WebsiteChatIdSchema,
    messages: z.array(z.unknown()).min(1).max(WEBSITE_CHAT_MAX_MESSAGES),
    model: WebsiteChatModelSchema.default(DEFAULT_WEBSITE_CHAT_MODEL),
    pagePath: z.string().max(300).optional(),
    greeting: z.string().max(300).optional(),
})

export const websiteChatRoute = express.Router()

// Streams the reply, so the website calls the function URL directly. Firebase Hosting would buffer the response.
websiteChatRoute.post('/chat', async (req, res) => {
    const body = WebsiteChatRequestSchema.safeParse(req.body)
    if (!body.success) {
        res.status(400).json({ error: 'Invalid chat request' })
        return
    }

    const messages = await safeValidateUIMessages({ messages: body.data.messages, tools: websiteChatTools })
    if (!messages.success) {
        res.status(400).json({ error: 'Invalid chat messages' })
        return
    }

    const isTooLong = messages.data.some((message) =>
        message.parts.some((part) => part.type === 'text' && part.text.length > WEBSITE_CHAT_MAX_MESSAGE_LENGTH)
    )
    if (isTooLong) {
        res.status(400).json({ error: 'Message is too long' })
        return
    }

    try {
        const stream = await streamWebsiteChat({
            chatId: body.data.id,
            messages: messages.data,
            // The widget's model picker is for testing only, so production always uses the default model.
            model: env === 'prod' ? DEFAULT_WEBSITE_CHAT_MODEL : body.data.model,
            pagePath: body.data.pagePath,
            greeting: body.data.greeting,
        })
        await pipeUIMessageStreamToResponse({ response: res, stream })
    } catch (err) {
        logError('Website chat request failed', err, { model: body.data.model })
        if (!res.headersSent) res.status(500).json({ error: 'Chat is unavailable' })
    }
})
