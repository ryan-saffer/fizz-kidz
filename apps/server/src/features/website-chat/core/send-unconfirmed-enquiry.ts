import { generateText, tool } from 'ai'
import { z } from 'zod'

import { DEFAULT_WEBSITE_CHAT_MODEL, type WebsiteChat } from '@fizz-kidz/core'

import { SubmitEnquiryInputSchema, submitWebsiteChatEnquiry } from './submit-enquiry-tool'
import { ENQUIRY_NOT_WANTED_NOTE, ENQUIRY_SHOWN_NOTE, formatTranscript } from './website-chat-transcript'

import { logError } from '@/integrations/observability/log-error'

const INSTRUCTIONS = `You read a chat between Frankie, the Fizz Kidz website chat assistant, and a customer who has since left without sending an enquiry.

If the customer gave their name, email address and phone number, call submit_enquiry so the Fizz Kidz team can follow up with them:
- Fill it in from what the customer said. Leave out anything they didn't give or weren't sure about.
- Use the service "other" if it isn't clear what they're after.
- Write the enquiry field as a short note for the team covering what they wanted, including any question they were waiting on.

Call skip instead if they haven't given all three, or if they said they don't want to be contacted or don't want their details sent.`

/**
 * A customer who gave their name, email and phone number is worth following up, even if they left before sending
 * an enquiry. Once the chat has gone idle, the enquiry is sent for them unless they tapped Don't send or asked not to
 * be contacted. The enquiry details tell them this while they're deciding.
 * Returns whether one was sent.
 */
export async function sendUnconfirmedEnquiry(chat: WebsiteChat) {
    const customerText = chat.messages
        .filter((message) => message.role === 'customer')
        .map((message) => message.text)
        .join('\n')
    // Most chats have no contact details, so these never reach the model.
    if (!hasEmail(customerText) || !hasPhoneNumber(customerText)) return false

    const transcript = formatTranscript(chat.messages)
    // They tapped Don't send, and weren't shown the details again afterwards.
    if (transcript.lastIndexOf(ENQUIRY_NOT_WANTED_NOTE) > transcript.lastIndexOf(ENQUIRY_SHOWN_NOTE)) return false

    try {
        const { toolCalls } = await generateText({
            model: DEFAULT_WEBSITE_CHAT_MODEL,
            instructions: INSTRUCTIONS,
            prompt: transcript,
            tools: {
                submit_enquiry: tool({ inputSchema: SubmitEnquiryInputSchema }),
                skip: tool({ inputSchema: z.object({ reason: z.string() }) }),
            },
            toolChoice: 'required',
            reasoning: 'low',
        })
        const call = toolCalls[0]
        if (call?.toolName !== 'submit_enquiry') return false

        const result = await submitWebsiteChatEnquiry(SubmitEnquiryInputSchema.parse(call.input), {
            chatTranscript: transcript,
            isUnconfirmed: true,
        })
        if (!result.success) {
            logError('Failed to send an unconfirmed website chat enquiry', undefined, {
                chatId: chat.id,
                problems: result.problems,
            })
        }
        return result.success
    } catch (err) {
        logError('Failed to send an unconfirmed website chat enquiry', err, { chatId: chat.id })
        return false
    }
}

function hasEmail(text: string) {
    return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)
}

function hasPhoneNumber(text: string) {
    return (text.match(/\+?\(?\d[\d\s()-]{6,}\d/g) ?? []).some((match) => match.replace(/\D/g, '').length >= 8)
}
