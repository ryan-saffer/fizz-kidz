import type { WebsiteChatTranscriptMessage } from '@fizz-kidz/core'

import { CONTEXT_NOTE_PREFIX } from './website-chat-context'

import type { ModelMessage, UIMessage } from 'ai'

export function getTranscriptFromUIMessages(messages: UIMessage[]): WebsiteChatTranscriptMessage[] {
    return messages.flatMap((message) => {
        if (message.role === 'system') return []
        const text = message.parts
            .map((part) => {
                if (part.type === 'text') return part.text
                if (part.type === 'tool-submit_enquiry' && part.state === 'output-available') {
                    return (part.output as { success?: boolean } | undefined)?.success
                        ? '[Enquiry sent to the team]'
                        : ''
                }
                return ''
            })
            .filter(Boolean)
            .join('\n\n')
            .trim()
        return text ? [{ role: message.role === 'user' ? 'customer' : 'frankie', text }] : []
    })
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
