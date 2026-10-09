// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { REPLY_BUBBLE_PAUSE_MS, usePacedReply } from './use-paced-reply'

import type { UIMessage } from 'ai'

const question: UIMessage = { id: 'q', role: 'user', parts: [{ type: 'text', text: 'Can parents stay?' }] }
const reply = (id: string, text: string): UIMessage => ({ id, role: 'assistant', parts: [{ type: 'text', text }] })
const threeBubbles = reply('a', 'Of course!\n\nOur studios fit 40 people.\n\nWhich studio suits you?')

describe('usePacedReply', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('shows a new reply one bubble at a time, after a typing pause', () => {
        const onReveal = vi.fn()
        const { result, rerender } = renderHook(({ messages }) => usePacedReply(messages, onReveal), {
            initialProps: { messages: [question] },
        })

        rerender({ messages: [question, threeBubbles] })
        expect(result.current).toMatchObject({ pacedMessageId: 'a', visibleCount: 1, isPacing: true })

        act(() => vi.advanceTimersByTime(REPLY_BUBBLE_PAUSE_MS))
        expect(result.current.visibleCount).toBe(2)

        act(() => vi.advanceTimersByTime(REPLY_BUBBLE_PAUSE_MS))
        expect(result.current).toMatchObject({ visibleCount: 3, isPacing: false })
        expect(onReveal).toHaveBeenCalledTimes(2)
    })

    it('shows a restored chat in full', () => {
        const { result } = renderHook(() => usePacedReply([question, threeBubbles], vi.fn()))

        expect(result.current).toMatchObject({ pacedMessageId: undefined, isPacing: false })
    })
})
