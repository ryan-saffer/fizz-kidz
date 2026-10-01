import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

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
                                    </span>
                                    <p
                                        className={cn(
                                            'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm',
                                            message.role === 'customer'
                                                ? 'rounded-br-md bg-violet-600 text-white'
                                                : 'rounded-bl-md bg-violet-50 text-slate-900'
                                        )}
                                    >
                                        {message.text}
                                    </p>
                                </div>
                            ))}
                        </section>
                    </>
                )}
            </div>
        </div>
    )
}
