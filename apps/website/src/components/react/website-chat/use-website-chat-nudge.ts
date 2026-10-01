import { useCallback, useEffect, useRef, useState } from 'react'

import { WEBSITE_CHAT_NUDGE_DELAY_SECONDS, getWebsiteChatNudge, type WebsiteChatGreeting } from '@fizz-kidz/core'

const VISIT_STORAGE_KEY = 'fizz-website-chat-visit'
// A short pause after arriving on a page, so the bubble never pops up the instant a page loads.
const MIN_DELAY_AFTER_PAGE_LOAD_MS = 3000
const RETRY_MS = 5000

type Visit = { startedAt: number; isDone: boolean }

function readVisit(): Visit {
    try {
        const stored = sessionStorage.getItem(VISIT_STORAGE_KEY)
        if (stored) return JSON.parse(stored) as Visit
        const visit = { startedAt: Date.now(), isDone: false }
        sessionStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(visit))
        return visit
    } catch {
        return { startedAt: Date.now(), isDone: false }
    }
}

function markVisitDone() {
    try {
        sessionStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify({ ...readVisit(), isDone: true }))
    } catch {
        // Without storage the bubble may show again on the next page load, which is acceptable.
    }
}

function isTypingInForm() {
    const element = document.activeElement
    return (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
    )
}

/**
 * Offers help in a speech bubble once per visit, after WEBSITE_CHAT_NUDGE_DELAY_SECONDS of browsing (counted across pages).
 * Never shows once the visitor has opened or used the chat.
 */
export function useWebsiteChatNudge({ isChatActive }: { isChatActive: boolean }) {
    const [nudge, setNudge] = useState<WebsiteChatGreeting>()
    const isChatActiveRef = useRef(isChatActive)
    isChatActiveRef.current = isChatActive

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined

        function tryShow() {
            if (readVisit().isDone || isChatActiveRef.current) return
            if (document.visibilityState !== 'visible' || isTypingInForm()) {
                timer = setTimeout(tryShow, RETRY_MS)
                return
            }
            const next = getWebsiteChatNudge({
                path: window.location.pathname,
                partyPackageName:
                    document.querySelector('meta[name="fizz-chat-party-package"]')?.getAttribute('content') ??
                    undefined,
            })
            // Pages where people are already enquiring return nothing; try again on the next page.
            if (!next) return
            markVisitDone()
            setNudge(next)
        }

        function schedule() {
            clearTimeout(timer)
            // The bubble is about the page it appeared on, so it goes when they navigate.
            setNudge(undefined)
            const visit = readVisit()
            if (visit.isDone) return
            const remaining = visit.startedAt + WEBSITE_CHAT_NUDGE_DELAY_SECONDS * 1000 - Date.now()
            timer = setTimeout(tryShow, Math.max(MIN_DELAY_AFTER_PAGE_LOAD_MS, remaining))
        }

        schedule()
        document.addEventListener('astro:page-load', schedule)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('astro:page-load', schedule)
        }
    }, [])

    useEffect(() => {
        if (isChatActive) {
            markVisitDone()
            setNudge(undefined)
        }
    }, [isChatActive])

    const dismiss = useCallback(() => setNudge(undefined), [])

    return { nudge, dismiss }
}
