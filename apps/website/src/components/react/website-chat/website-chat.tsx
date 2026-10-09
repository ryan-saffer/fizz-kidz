import { useChat } from '@ai-sdk/react'
import {
    DefaultChatTransport,
    generateId,
    lastAssistantMessageIsCompleteWithApprovalResponses,
    type UIMessage,
} from 'ai'
import { ArrowUp, MessageCircle, RotateCcw, Square, Volume2, VolumeX, X } from 'lucide-react'
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type AnimationEvent,
    type FormEvent,
    type KeyboardEvent,
    type ReactNode,
} from 'react'
import { Streamdown } from 'streamdown'

import {
    DEFAULT_WEBSITE_CHAT_MODEL,
    WEBSITE_CHAT_IDLE_MINUTES,
    WEBSITE_CHAT_MAX_MESSAGE_LENGTH,
    WebsiteChatModelOptions,
    type WebsiteChatModel,
} from '@fizz-kidz/core'

import { EnquiryConfirmation } from './enquiry-confirmation'
import { useEnquiryLeadTracking } from './use-enquiry-lead-tracking'
import { usePacedReply } from './use-paced-reply'
import { useWebsiteChatNudge } from './use-website-chat-nudge'
import { DEFAULT_WEBSITE_CHAT_GREETING, type WebsiteChatGreeting } from './website-chat-greetings'
import { getReplyItems } from './website-chat-reply'
import { playReplySound, playSendSound } from './website-chat-sounds'

import { cn } from '@/react-lib/utils'
import { Bubble, BubbleContent } from '@/react-ui/bubble'
import { Message, MessageContent } from '@/react-ui/message'
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '@/react-ui/message-scroller'
import { IS_MODEL_PICKER_ENABLED, WEBSITE_CHAT_URL } from '@/utils/website-chat'

const STORAGE_KEY = 'fizz-website-chat'
const MUTED_STORAGE_KEY = 'fizz-website-chat-muted'
const LAUNCHER_INTRO_STORAGE_KEY = 'fizz-website-chat-launcher-intro'
// On a visit's first page, the launcher waits before appearing so visitors can settle in.
const LAUNCHER_DELAY_MS = 4000
// Matches the launcher animations in globals.css: a 0.7s slide up, then the icon wave (just after the label has
// expanded) ending at 2.8s.
const LAUNCHER_INTRO_MS = 3000
// The launcher arrives as an icon, then its "Chat with us" label expands in before the icon waves. The label stays
// on wider screens; on phones it collapses back to the icon after a few seconds.
const LAUNCHER_LABEL_DELAY_MS = 900
const LAUNCHER_MOBILE_LABEL_MS = 3900

// Opening a new chat: for each greeting message Frankie types, then writes it out word by word.
// Once the last one is written, the quick replies enter one by one.
const GREETING_FIRST_TYPING_MS = 1400
const GREETING_NEXT_TYPING_MS = 1000
const GREETING_WORD_MS = 45
const SUGGESTIONS_PAUSE_MS = 400
const SUGGESTION_STAGGER_MS = 120

// Colours from the stacked Fizz Kidz logo, plus the site's yellow, for small accents around the purple.
const FIZZ_STRIPE = ['#E91271', '#FFDC5D', '#9ECC47', '#4BC5D9']
const WEBSITE_CHAT_UNAVAILABLE_MESSAGE =
    'Oops, my fizz has gone a little flat! 🫧 Give me a moment and try again, or call the team on (03) 9059 8144.'

// The greeting (DEFAULT_WEBSITE_CHAT_GREETING in website-chat-greetings.ts) is shown by the widget before the first message, with quick
// replies that send as the customer's message. Opening from Frankie's speech bubble uses that page's greeting instead.

type StoredChat = {
    id: string
    messages: UIMessage[]
    model: WebsiteChatModel
    lastActivityAt: number
    greeting: WebsiteChatGreeting
}

function readStoredChat(): Partial<StoredChat> | undefined {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY)
        if (!stored) return undefined
        const chat = JSON.parse(stored) as Partial<StoredChat>
        // The server finishes idle conversations, so an old one starts afresh (keeping the model choice).
        const isIdle = !chat.lastActivityAt || Date.now() - chat.lastActivityAt > WEBSITE_CHAT_IDLE_MINUTES * 60 * 1000
        return isIdle ? { model: chat.model } : chat
    } catch {
        return undefined
    }
}

function writeStoredChat(chat: StoredChat) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat))
    } catch {
        // Storage can be unavailable (private mode). The chat still works for this page.
    }
}

/** The launcher's entrance plays once per visit, not on every page. */
function hasSeenLauncherIntro() {
    try {
        return sessionStorage.getItem(LAUNCHER_INTRO_STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

function markLauncherIntroSeen() {
    try {
        sessionStorage.setItem(LAUNCHER_INTRO_STORAGE_KEY, 'true')
    } catch {
        // Without storage the intro plays again on the next full page load, which is acceptable.
    }
}

function readMuted() {
    try {
        return localStorage.getItem(MUTED_STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

function writeMuted(muted: boolean) {
    try {
        localStorage.setItem(MUTED_STORAGE_KEY, String(muted))
    } catch {
        // Storage can be unavailable. Muting still applies for this visit.
    }
}

export function WebsiteChat() {
    const [storedChat] = useState(readStoredChat)
    const [chatId, setChatId] = useState(() => storedChat?.id ?? generateId())
    const [isOpen, setIsOpen] = useState(false)
    // The panel stays mounted while its exit animation plays, then onPanelAnimationEnd closes it.
    const [isClosing, setIsClosing] = useState(false)
    function openChat() {
        setIsClosing(false)
        setIsOpen(true)
    }
    function closeChat() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setIsOpen(false)
        else setIsClosing(true)
    }
    function onPanelAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
        // Children animate too (quick replies, typing dots), and their animationend events bubble up here.
        if (event.target !== event.currentTarget || !isClosing) return
        setIsClosing(false)
        setIsOpen(false)
    }
    const [playLauncherIntro, setPlayLauncherIntro] = useState(() => !hasSeenLauncherIntro())
    const [isLauncherShown, setIsLauncherShown] = useState(() => !playLauncherIntro)
    // Matches Tailwind's `sm` breakpoint, where the launcher keeps its label.
    const [isWideScreen] = useState(() => window.matchMedia('(min-width: 640px)').matches)
    const [isLauncherLabelShown, setIsLauncherLabelShown] = useState(() => !playLauncherIntro && isWideScreen)
    // The label animates its width to exactly its text width, so the whole transition is visible movement.
    // Measured again once fonts load, since the brand font changes the width.
    const [launcherLabelWidth, setLauncherLabelWidth] = useState<number>()
    const measureLauncherLabel = useCallback((label: HTMLSpanElement | null) => {
        if (!label) return
        setLauncherLabelWidth(label.scrollWidth)
        void document.fonts?.ready.then(() => setLauncherLabelWidth(label.scrollWidth))
    }, [])
    useEffect(() => {
        if (isLauncherShown) return
        const timer = setTimeout(() => {
            markLauncherIntroSeen()
            setIsLauncherShown(true)
        }, LAUNCHER_DELAY_MS)
        return () => clearTimeout(timer)
    }, [isLauncherShown])
    const [hasFinePointer] = useState(() => window.matchMedia('(pointer: fine)').matches)
    useEffect(() => {
        // Astro moves this persisted widget into each new page, and browsers restart CSS animations on a moved
        // element. Removing the intro classes once it's played stops it replaying on every navigation.
        if (!playLauncherIntro || !isLauncherShown) return
        const labelTimer = setTimeout(() => setIsLauncherLabelShown(true), LAUNCHER_LABEL_DELAY_MS)
        const introTimer = setTimeout(() => setPlayLauncherIntro(false), LAUNCHER_INTRO_MS)
        return () => {
            clearTimeout(labelTimer)
            clearTimeout(introTimer)
        }
    }, [playLauncherIntro, isLauncherShown])
    useEffect(() => {
        if (!isLauncherLabelShown || isWideScreen) return
        const timer = setTimeout(() => setIsLauncherLabelShown(false), LAUNCHER_MOBILE_LABEL_MS)
        return () => clearTimeout(timer)
    }, [isLauncherLabelShown, isWideScreen])
    const [greeting, setGreeting] = useState<WebsiteChatGreeting>(() =>
        // Chats saved before greetings had several messages fall back to the default.
        Array.isArray(storedChat?.greeting?.messages) ? storedChat.greeting : DEFAULT_WEBSITE_CHAT_GREETING
    )
    // A new chat plays the greeting message by message. Restored chats show it straight away.
    const hasStoredMessages = (storedChat?.messages?.length ?? 0) > 0
    const [greetingStep, setGreetingStep] = useState(() => (hasStoredMessages ? greeting.messages.length : 0))
    const [greetingPhase, setGreetingPhase] = useState<'typing' | 'writing' | 'shown'>(() =>
        hasStoredMessages ? 'shown' : 'typing'
    )
    const [greetingWordCount, setGreetingWordCount] = useState(0)
    // Only animate while it's happening, so reopening the chat doesn't replay it.
    const [isGreetingAnimating, setIsGreetingAnimating] = useState(false)
    const [model, setModel] = useState<WebsiteChatModel>(
        () =>
            WebsiteChatModelOptions.find((option) => option.value === storedChat?.model)?.value ??
            DEFAULT_WEBSITE_CHAT_MODEL
    )
    const [input, setInput] = useState('')
    const modelRef = useRef(model)
    modelRef.current = model
    const greetingRef = useRef(greeting)
    greetingRef.current = greeting
    const lastActivityAtRef = useRef(storedChat?.lastActivityAt ?? Date.now())

    const [transport] = useState(
        () =>
            new DefaultChatTransport({
                api: WEBSITE_CHAT_URL,
                body: () => ({
                    ...(IS_MODEL_PICKER_ENABLED && { model: modelRef.current }),
                    pagePath: window.location.pathname,
                    greeting: greetingRef.current.messages.join(' '),
                }),
            })
    )
    const { messages, sendMessage, addToolApprovalResponse, status, stop, error } = useChat({
        id: chatId,
        messages: chatId === storedChat?.id ? storedChat.messages : undefined,
        transport,
        // Tapping Send enquiry or Change something answers Frankie's enquiry, and the chat carries on from there.
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    })

    useEnquiryLeadTracking(messages)

    useEffect(() => {
        if (messages.length > 0 && (status === 'ready' || status === 'error')) {
            writeStoredChat({ id: chatId, messages, model, lastActivityAt: lastActivityAtRef.current, greeting })
        }
    }, [chatId, messages, model, status, greeting])

    const { nudge, dismiss: dismissNudge } = useWebsiteChatNudge({ isChatActive: isOpen || messages.length > 0 })

    function openFromNudge() {
        if (nudge && messages.length === 0) {
            setGreeting(nudge)
            setGreetingStep(nudge.messages.length)
        }
        // They've just read the bubble, so the greeting appears without typing first.
        setGreetingPhase('shown')
        setIsGreetingAnimating(true)
        openChat()
    }

    const isBusy = status === 'submitted' || status === 'streaming'
    // The stream starts before any words arrive (models think first), so "typing" lasts until the reply has content.
    const isTyping = isBusy && !hasVisibleReply(messages[messages.length - 1])

    const [isMuted, setIsMuted] = useState(readMuted)
    const wasTypingRef = useRef(isTyping)
    useEffect(() => {
        // One sound per reply, as its first words appear.
        if (wasTypingRef.current && !isTyping && status === 'streaming' && isOpen && !isMuted) {
            playReplySound()
        }
        wasTypingRef.current = isTyping
    }, [isTyping, status, isOpen, isMuted])

    // Each bubble after the first in a new reply follows a typing pause, with its own sound.
    const { pacedMessageId, visibleCount, isPacing } = usePacedReply(messages, () => {
        if (isOpen && !isMuted) playReplySound()
    })

    function finishGreetingMessage() {
        const nextStep = greetingStep + 1
        setGreetingStep(nextStep)
        setGreetingPhase(nextStep < greeting.messages.length ? 'typing' : 'shown')
    }

    useEffect(() => {
        if (!isOpen) {
            setIsGreetingAnimating(false)
            return
        }
        if (greetingPhase !== 'typing') return
        const timer = setTimeout(
            () => {
                setIsGreetingAnimating(true)
                if (!isMuted) playReplySound()
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    finishGreetingMessage()
                    return
                }
                setGreetingWordCount(0)
                setGreetingPhase('writing')
            },
            greetingStep === 0 ? GREETING_FIRST_TYPING_MS : GREETING_NEXT_TYPING_MS
        )
        return () => clearTimeout(timer)
        // finishGreetingMessage only reads state that's already listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, greetingPhase, greetingStep, isMuted])

    const writingWords = greeting.messages[greetingStep]?.split(' ') ?? []
    useEffect(() => {
        if (greetingPhase !== 'writing') return
        if (greetingWordCount >= writingWords.length) {
            finishGreetingMessage()
            return
        }
        const timer = setTimeout(() => setGreetingWordCount((count) => count + 1), GREETING_WORD_MS)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [greetingPhase, greetingWordCount, writingWords.length])

    function toggleMuted() {
        setIsMuted((muted) => {
            writeMuted(!muted)
            return !muted
        })
    }

    function send(text: string) {
        const trimmed = text.trim()
        if (!trimmed || isBusy) return
        lastActivityAtRef.current = Date.now()
        if (!isMuted) playSendSound()
        sendMessage({ text: trimmed })
        setInput('')
    }

    function respondToEnquiry(response: { id: string; approved: boolean; reason?: string }) {
        if (isBusy) return
        lastActivityAtRef.current = Date.now()
        if (response.approved && !isMuted) playSendSound()
        addToolApprovalResponse(response)
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault()
        send(input)
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            send(input)
        }
    }

    function restart() {
        stop()
        const id = generateId()
        setChatId(id)
        setGreeting(DEFAULT_WEBSITE_CHAT_GREETING)
        setGreetingStep(0)
        setGreetingPhase('typing')
        writeStoredChat({
            id,
            messages: [],
            model,
            lastActivityAt: Date.now(),
            greeting: DEFAULT_WEBSITE_CHAT_GREETING,
        })
    }

    return (
        <div className="print:hidden">
            {isOpen && (
                <div
                    // Above the sticky site header (z-[99]), which otherwise covers the close button on phones.
                    role="dialog"
                    aria-label="Chat with Fizz Kidz"
                    className={cn(
                        'fixed inset-0 z-[1000] flex flex-col overflow-hidden bg-white font-gotham shadow-2xl motion-reduce:animate-none sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[400px] sm:origin-bottom-right sm:rounded-3xl sm:border sm:border-[#E8DBFD]',
                        // Phones: a full-screen sheet sliding up from the bottom edge. Wider screens: a small grow and fade
                        // from the launcher. Closing plays the reverse.
                        isClosing
                            ? 'duration-200 ease-in animate-out fill-mode-forwards slide-out-to-bottom-full sm:fade-out sm:zoom-out-95 sm:slide-out-to-bottom-4'
                            : 'duration-300 ease-out animate-in slide-in-from-bottom-full sm:duration-200 sm:fade-in sm:zoom-in-95 sm:slide-in-from-bottom-4'
                    )}
                    onAnimationEnd={onPanelAnimationEnd}
                >
                    <header className="flex items-center gap-3 bg-[#9044E2] px-4 py-3 text-white">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-sm">
                            <img src="/images/logo-stacked-192.png" alt="" width={32} height={32} className="h-8 w-8" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="font-lilita text-xl leading-tight">Frankie</p>
                            <p className="text-xs text-white/80">Ask me anything about parties and programs</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleMuted}
                            className="rounded-full p-2 hover:bg-white/15"
                            aria-label={isMuted ? 'Turn chat sounds on' : 'Turn chat sounds off'}
                            aria-pressed={isMuted}
                        >
                            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                        {messages.length > 0 && (
                            <button
                                type="button"
                                onClick={restart}
                                className="rounded-full p-2 hover:bg-white/15"
                                aria-label="Start a new chat"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={closeChat}
                            className="rounded-full p-2 hover:bg-white/15"
                            aria-label="Close chat"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </header>
                    <div className="flex h-1 shrink-0" aria-hidden="true">
                        {FIZZ_STRIPE.map((colour) => (
                            <span key={colour} className="flex-1" style={{ backgroundColor: colour }} />
                        ))}
                    </div>

                    {IS_MODEL_PICKER_ENABLED && (
                        <select
                            value={model}
                            onChange={(event) => setModel(event.target.value as WebsiteChatModel)}
                            className="border-b border-[#E8DBFD] bg-[#F7F2FE] px-4 py-1.5 text-xs text-[#542785] outline-none"
                            aria-label="Model (testing only)"
                        >
                            {WebsiteChatModelOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    Testing: {option.label}
                                </option>
                            ))}
                        </select>
                    )}

                    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                        <MessageScroller className="flex-1">
                            <MessageScrollerViewport className="px-4">
                                <MessageScrollerContent className="gap-4 py-4">
                                    <MessageScrollerItem messageId="welcome">
                                        <div className="flex flex-col gap-2">
                                            {greeting.messages.map((text, index) => {
                                                const isFullyShown =
                                                    messages.length > 0 ||
                                                    greetingPhase === 'shown' ||
                                                    index < greetingStep
                                                if (isFullyShown)
                                                    return <AssistantBubble key={index}>{text}</AssistantBubble>
                                                if (index !== greetingStep) return null
                                                return (
                                                    <AssistantBubble key={index}>
                                                        {greetingPhase === 'writing' ? (
                                                            writingWords.slice(0, greetingWordCount).join(' ')
                                                        ) : (
                                                            <TypingDots />
                                                        )}
                                                    </AssistantBubble>
                                                )
                                            })}
                                        </div>
                                    </MessageScrollerItem>

                                    {messages.length === 0 && greetingPhase === 'shown' && (
                                        <MessageScrollerItem messageId="suggestions">
                                            <div className="flex flex-wrap gap-2">
                                                {greeting.suggestions.map((suggestion, index) => (
                                                    <button
                                                        key={suggestion}
                                                        type="button"
                                                        onClick={() => send(suggestion)}
                                                        className={cn(
                                                            'rounded-full border border-[#9044E2] px-3 py-1.5 text-left text-sm text-[#542785] transition-colors hover:bg-[#F7F2FE]',
                                                            isGreetingAnimating &&
                                                                'duration-300 animate-in fade-in fill-mode-both slide-in-from-bottom-1 motion-reduce:animate-none'
                                                        )}
                                                        style={
                                                            isGreetingAnimating
                                                                ? {
                                                                      animationDelay: `${SUGGESTIONS_PAUSE_MS + index * SUGGESTION_STAGGER_MS}ms`,
                                                                  }
                                                                : undefined
                                                        }
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        </MessageScrollerItem>
                                    )}

                                    {messages.map((message) => (
                                        <MessageScrollerItem key={message.id} messageId={message.id}>
                                            {message.role === 'user' ? (
                                                <Message align="end">
                                                    <MessageContent>
                                                        <Bubble align="end">
                                                            <BubbleContent className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#9044E2] text-white">
                                                                {getMessageText(message)}
                                                            </BubbleContent>
                                                        </Bubble>
                                                    </MessageContent>
                                                </Message>
                                            ) : (
                                                <AssistantMessage
                                                    message={message}
                                                    isStreaming={
                                                        status === 'streaming' &&
                                                        message.id === messages[messages.length - 1]?.id
                                                    }
                                                    canRespond={
                                                        !isBusy && message.id === messages[messages.length - 1]?.id
                                                    }
                                                    visibleCount={
                                                        message.id === pacedMessageId ? visibleCount : undefined
                                                    }
                                                    onRespondToEnquiry={respondToEnquiry}
                                                />
                                            )}
                                        </MessageScrollerItem>
                                    ))}

                                    {(isTyping || isPacing) && (
                                        <MessageScrollerItem messageId="typing">
                                            <AssistantBubble>
                                                <TypingDots />
                                            </AssistantBubble>
                                        </MessageScrollerItem>
                                    )}

                                    {error && (
                                        <MessageScrollerItem messageId="error">
                                            {/* Failures read as a message from Frankie, so the chat still feels live. */}
                                            <AssistantBubble>{WEBSITE_CHAT_UNAVAILABLE_MESSAGE}</AssistantBubble>
                                        </MessageScrollerItem>
                                    )}
                                </MessageScrollerContent>
                            </MessageScrollerViewport>
                            <MessageScrollerButton />
                        </MessageScroller>
                    </MessageScrollerProvider>

                    <form
                        onSubmit={handleSubmit}
                        className="border-t border-[#E8DBFD] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3"
                    >
                        <div className="flex items-end gap-2 rounded-2xl border border-[#E8DBFD] bg-white p-2 focus-within:border-[#9044E2]">
                            <textarea
                                // The panel mounts when opened, so this focuses the input on every open. Only with a mouse or
                                // trackpad: on touch screens it would pop up the keyboard over Frankie's welcome messages.
                                autoFocus={hasFinePointer}
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                onKeyDown={handleKeyDown}
                                maxLength={WEBSITE_CHAT_MAX_MESSAGE_LENGTH}
                                rows={1}
                                placeholder="Type your question…"
                                aria-label="Message"
                                className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none [field-sizing:content] sm:text-sm"
                            />
                            {isBusy ? (
                                <button
                                    type="button"
                                    onClick={() => stop()}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#542785] text-white"
                                    aria-label="Stop"
                                >
                                    <Square className="h-3.5 w-3.5 fill-current" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={!input.trim()}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#9044E2] text-white transition-colors hover:bg-[#7732BE] disabled:opacity-40"
                                    aria-label="Send"
                                >
                                    <ArrowUp className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {nudge && !isOpen && (
                <div className="fixed bottom-20 right-4 z-50 w-[min(280px,calc(100vw-2rem))] duration-300 animate-in fade-in slide-in-from-bottom-2 sm:bottom-24 sm:right-6">
                    <button
                        type="button"
                        onClick={openFromNudge}
                        className="w-full rounded-2xl rounded-br-md border border-[#E8DBFD] bg-white px-4 py-3 pr-9 text-left font-gotham text-sm text-[#1F1433] shadow-lg transition-colors hover:bg-[#F7F2FE]"
                    >
                        {nudge.messages.join(' ')}
                    </button>
                    <button
                        type="button"
                        onClick={dismissNudge}
                        className="absolute right-2 top-2 rounded-full p-1 text-[#542785]/70 hover:bg-[#F7F2FE] hover:text-[#542785]"
                        aria-label="Dismiss"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {isLauncherShown && (
                <button
                    type="button"
                    onClick={() => (isOpen ? closeChat() : openChat())}
                    className={cn(
                        // A round icon, with the "Chat with us" label expanding beside it (see isLauncherLabelShown).
                        'fixed bottom-4 right-4 z-50 flex h-12 items-center justify-center rounded-full bg-[#9044E2] px-3.5 font-lilita text-lg text-white shadow-lg transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#7732BE] sm:bottom-6 sm:right-6 sm:h-14',
                        // A pill with the label when closed; a circle around the close icon when open.
                        isOpen ? 'hidden sm:flex sm:w-14 sm:px-0' : 'sm:px-4',
                        playLauncherIntro && 'chat-launcher-enter'
                    )}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? 'Close chat' : 'Chat with us'}
                >
                    {isOpen ? (
                        <X className="h-6 w-6" />
                    ) : (
                        <MessageCircle
                            className={cn('h-5 w-5 sm:h-6 sm:w-6', playLauncherIntro && 'chat-launcher-wave')}
                        />
                    )}
                    {!isOpen && (
                        <span
                            ref={measureLauncherLabel}
                            className={cn(
                                'overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] [transition-duration:500ms] ease-in-out motion-reduce:transition-none',
                                isLauncherLabelShown ? 'ml-2 mr-1 opacity-100' : 'ml-0 mr-0 opacity-0'
                            )}
                            style={{ maxWidth: isLauncherLabelShown ? (launcherLabelWidth ?? 160) : 0 }}
                        >
                            Chat with us
                        </span>
                    )}
                </button>
            )}
        </div>
    )
}

function AssistantMessage({
    message,
    isStreaming,
    canRespond,
    visibleCount,
    onRespondToEnquiry,
}: {
    message: UIMessage
    isStreaming: boolean
    canRespond: boolean
    /** How many bubbles of a new reply to show so far (see usePacedReply). All of them when left out. */
    visibleCount?: number
    onRespondToEnquiry: (response: { id: string; approved: boolean; reason?: string }) => void
}) {
    const items = getReplyItems(message)
    const visibleItems = visibleCount === undefined ? items : items.slice(0, visibleCount)
    return (
        <div className="flex flex-col gap-2">
            {visibleItems.map((item, index) => {
                // Bubbles revealed after a typing pause enter like the greeting's quick replies.
                const enter =
                    visibleCount !== undefined &&
                    index > 0 &&
                    'duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none'
                if (item.kind === 'text') {
                    return (
                        <div key={item.key} className={cn(enter)}>
                            <AssistantBubble>
                                <Streamdown
                                    className="website-chat-markdown"
                                    linkSafety={{ enabled: true, onLinkCheck: isFizzKidzUrl }}
                                    isAnimating={isStreaming && index === items.length - 1}
                                >
                                    {linkifyBareUrls(item.text)}
                                </Streamdown>
                            </AssistantBubble>
                        </div>
                    )
                }
                const part = message.parts[item.partIndex]
                if (part.type !== 'tool-submit_enquiry') return null
                return (
                    <div key={item.key} className={cn(enter)}>
                        <EnquiryConfirmation
                            state={part.state}
                            input={part.input}
                            output={part.output}
                            approval={part.approval}
                            canRespond={canRespond}
                            onRespond={onRespondToEnquiry}
                        />
                    </div>
                )
            })}
        </div>
    )
}

function TypingDots() {
    return (
        <span className="flex gap-1 py-1" aria-label="Typing">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#9044E2] [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#9044E2] [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#9044E2]" />
        </span>
    )
}

function AssistantBubble({ children }: { children: ReactNode }) {
    return (
        <Message>
            <MessageContent>
                <Bubble variant="muted">
                    <BubbleContent className="rounded-2xl rounded-bl-md bg-[#F7F2FE] text-[#1F1433]">
                        {children}
                    </BubbleContent>
                </Bubble>
            </MessageContent>
        </Message>
    )
}

function getMessageText(message: UIMessage) {
    return message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('')
}

function isFizzKidzUrl(url: string) {
    try {
        return new URL(url).hostname.endsWith('fizzkidz.com.au')
    } catch {
        return false
    }
}

// Frankie is told to always use named links, but models occasionally write a bare URL.
// Turn bare Fizz Kidz URLs into named links, e.g. https://www.fizzkidz.com.au/contact-us/ becomes [Contact us](...).
function linkifyBareUrls(text: string) {
    return text.replace(/(?<![(<[])https?:\/\/[^\s)\]>]+/g, (match) => {
        const url = match.replace(/[.,!?;:'"]+$/, '')
        const trailing = match.slice(url.length)
        const label = getLinkLabel(url)
        return label ? `[${label}](${url})${trailing}` : match
    })
}

function getLinkLabel(url: string) {
    try {
        const { hostname, pathname } = new URL(url)
        if (hostname === 'bookings.fizzkidz.com.au') return 'Book online'
        if (!hostname.endsWith('fizzkidz.com.au')) return undefined
        const slug = pathname.split('/').filter(Boolean).pop()
        if (!slug) return 'Fizz Kidz'
        const words = slug.replace(/-/g, ' ')
        return words.charAt(0).toUpperCase() + words.slice(1)
    } catch {
        return undefined
    }
}

function hasVisibleReply(message: UIMessage | undefined) {
    return (
        message?.role === 'assistant' &&
        message.parts.some(
            (part) => (part.type === 'text' && part.text.trim() !== '') || part.type === 'tool-submit_enquiry'
        )
    )
}
