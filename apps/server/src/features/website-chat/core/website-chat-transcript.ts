import { WEBSITE_CHAT_DONT_SEND_REASON, type WebsiteChatTranscriptMessage } from '@fizz-kidz/core'

import { CONTEXT_NOTE_PREFIX } from './website-chat-context'

import type { ModelMessage, UIMessage } from 'ai'

export function getTranscriptFromUIMessages(messages: UIMessage[]): WebsiteChatTranscriptMessage[] {
    return messages.flatMap((message) => {
        if (message.role === 'system') return []
        const text = message.parts
            .map((part) => {
                if (part.type === 'text') return part.text
                if (part.type === 'tool-submit_enquiry') return getEnquiryNote(part.state, part.output, part.approval)
                return ''
            })
            .filter(Boolean)
            .join('\n\n')
            .trim()
        return text ? [{ role: message.role === 'user' ? 'customer' : 'frankie', text }] : []
    })
}

// Notes in the transcript for Frankie's enquiry details, so it shows (and sendUnconfirmedEnquiry can check) what the
// customer chose.
export const ENQUIRY_SHOWN_NOTE = '[Showed the enquiry details to confirm]'
export const ENQUIRY_NOT_WANTED_NOTE = '[Customer chose not to send the enquiry]'

function getEnquiryNote(state: string, output: unknown, approval?: { approved?: boolean; reason?: string }) {
    if (state === 'output-available') {
        return (output as { success?: boolean } | undefined)?.success ? '[Enquiry sent to the team]' : ''
    }
    if (approval?.approved === false && approval.reason === WEBSITE_CHAT_DONT_SEND_REASON) {
        return ENQUIRY_NOT_WANTED_NOTE
    }
    if (state === 'output-denied' || approval?.approved === false) return '[Customer chose to change the details]'
    if (state === 'approval-requested') return ENQUIRY_SHOWN_NOTE
    return ''
}

export function getTranscriptFromModelMessages(messages: ModelMessage[]): WebsiteChatTranscriptMessage[] {
    return messages.flatMap((message) => {
        if (message.role !== 'user' && message.role !== 'assistant') return []
        const text =
            typeof message.content === 'string'
                ? message.content
                : message.content
                      .map((part) =>
                          part.type === 'text' && !part.text.startsWith(CONTEXT_NOTE_PREFIX) ? part.text : ''
                      )
                      .join('')
                      .trim()
        return text ? [{ role: message.role === 'user' ? 'customer' : 'frankie', text }] : []
    })
}

export function formatTranscript(transcript: WebsiteChatTranscriptMessage[]) {
    return transcript
        .map((message) => `${message.role === 'customer' ? 'Customer' : 'Frankie'}: ${message.text}`)
        .join('\n\n')
}
