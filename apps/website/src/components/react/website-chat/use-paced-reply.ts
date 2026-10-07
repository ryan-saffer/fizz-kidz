import { useEffect, useRef, useState } from 'react'

import { getReplyItems } from './website-chat-reply'

import type { UIMessage } from 'ai'

// How long Frankie "types" before each bubble after the first, like the opening greeting.
export const REPLY_BUBBLE_PAUSE_MS = 1000

/**
 * Shows a new reply from Frankie one bubble at a time, with a typing pause before each one after the first.
 * Only the latest reply is paced, and only if it arrived while the page was open: a restored chat shows in full.
 */
export function usePacedReply(messages: UIMessage[], onReveal: () => void) {
    const restoredIdsRef = useRef(new Set(messages.map((message) => message.id)))
    const onRevealRef = useRef(onReveal)
    onRevealRef.current = onReveal

    const latest = messages[messages.length - 1]
    const pacedMessageId =
        latest?.role === 'assistant' && !restoredIdsRef.current.has(latest.id) ? latest.id : undefined
    const itemCount = pacedMessageId ? getReplyItems(latest).length : 0

    const [revealed, setRevealed] = useState<{ messageId?: string; count: number }>({ count: 1 })
    const visibleCount = revealed.messageId === pacedMessageId ? revealed.count : 1
    const hasMore = pacedMessageId !== undefined && visibleCount < itemCount

    useEffect(() => {
        if (!hasMore) return
        const timer = setTimeout(() => {
            setRevealed({ messageId: pacedMessageId, count: visibleCount + 1 })
            onRevealRef.current()
        }, REPLY_BUBBLE_PAUSE_MS)
        return () => clearTimeout(timer)
    }, [hasMore, pacedMessageId, visibleCount])

    return { pacedMessageId, visibleCount, isPacing: hasMore }
}
