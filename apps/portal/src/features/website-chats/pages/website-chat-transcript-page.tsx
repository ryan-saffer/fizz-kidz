import { useQuery } from '@tanstack/react-query'
import { format, isSameDay } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Streamdown } from 'streamdown'

import { splitWebsiteChatBubbles, type WebsiteChatTranscriptMessage } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { Badge } from '@shared/components/ui/badge'
import { Skeleton } from '@shared/components/ui/skeleton'
import { cn } from '@shared/lib/tailwind'

/** One website chat, shown as the conversation the customer had with Frankie. */
export function WebsiteChatTranscriptPage() {
    const { chatId = '' } = useParams()
    const trpc = useTRPC()
    const { data: chat, isPending, isError } = useQuery(trpc.websiteChats.get.queryOptions({ id: chatId }))

    return (
        <div className="twp min-h-[calc(100vh-4rem)] bg-slate-100 px-4 py-8 sm:px-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <Link
                    to=".."
                    relative="path"
                    className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
                >
                    <ArrowLeft className="h-4 w-4" />
                    All chat transcripts
                </Link>

                {isPending ? (
                    <Skeleton className="h-96 w-full rounded-2xl" />
                ) : isError ? (
                    <p className="text-slate-600">Unable to load this chat.</p>
                ) : (
                    <>
                        <header className="flex flex-col gap-2">
                            <h1 className="font-lilita text-3xl font-normal text-slate-900">
                                {format(new Date(chat.startedAt), 'EEEE d MMMM yyyy, h:mm a')}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                {chat.enquirySubmitted && <Badge>Enquiry sent</Badge>}
                                <span>{chat.messageCount} customer messages</span>
                                <span>·</span>
                                <span>Started on {chat.entryPage ?? 'an unknown page'}</span>
                                <span>·</span>
                                <span>{chat.model}</span>
                                <span>·</span>
                                <span className="font-mono text-xs">{chat.id}</span>
                            </div>
                        </header>

                        <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
                            {chat.messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        'flex flex-col gap-1',
                                        message.role === 'customer' ? 'items-end' : 'items-start'
                                    )}
                                >
                                    <span className="px-1 text-xs text-slate-500">
                                        {message.role === 'customer' ? 'Customer' : 'Frankie'}
                                        {message.sentAt && ` · ${formatSentAt(message.sentAt, chat.startedAt)}`}
                                    </span>
                                    <TranscriptBubbles message={message} />
                                </div>
                            ))}
                        </section>
                    </>
                )}
            </div>
        </div>
    )
}

// Notes added to the transcript, like "[Enquiry sent to the team]", rather than words the customer read.
const TRANSCRIPT_NOTE = /^\[.+\]$/

/** A message as the customer saw it: each of Frankie's paragraphs is its own bubble, with links rendered. */
function TranscriptBubbles({ message }: { message: WebsiteChatTranscriptMessage }) {
    if (message.role === 'customer') {
        return (
            <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-violet-600 px-4 py-2 text-sm text-white">
                {message.text}
            </p>
        )
    }
    return splitWebsiteChatBubbles(message.text).map((bubble, index) =>
        TRANSCRIPT_NOTE.test(bubble) ? (
            <p key={index} className="px-1 text-xs italic text-slate-500">
                {bubble.slice(1, -1)}
            </p>
        ) : (
            <div
                key={index}
                className="max-w-[85%] rounded-2xl rounded-bl-md bg-violet-50 px-4 py-2 text-sm text-slate-900 [&_a]:font-semibold [&_a]:text-violet-700 [&_a]:underline"
            >
                <Streamdown linkSafety={{ enabled: false }}>{bubble}</Streamdown>
            </div>
        )
    )
}

// The time, plus the date when it's a different day from the start, e.g. a chat resumed the next morning.
function formatSentAt(sentAt: string, startedAt: string) {
    const sent = new Date(sentAt)
    return format(sent, isSameDay(sent, new Date(startedAt)) ? 'h:mm a' : 'd MMM, h:mm a')
}
