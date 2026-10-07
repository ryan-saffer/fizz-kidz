import { splitWebsiteChatBubbles } from '@fizz-kidz/core'

import type { UIMessage } from 'ai'

/** One bubble in Frankie's reply: a short message, or the enquiry details to confirm. */
export type ReplyItem =
    | { key: string; kind: 'text'; text: string; partIndex: number }
    | { key: string; kind: 'enquiry'; partIndex: number }

export function getReplyItems(message: UIMessage): ReplyItem[] {
    return message.parts.flatMap((part, partIndex): ReplyItem[] => {
        if (part.type === 'text') {
            return splitWebsiteChatBubbles(part.text).map((text, index) => ({
                key: `${partIndex}-${index}`,
                kind: 'text',
                text,
                partIndex,
            }))
        }
        if (part.type === 'tool-submit_enquiry') return [{ key: `${partIndex}`, kind: 'enquiry', partIndex }]
        return []
    })
}
