import { format } from 'date-fns'
import { CheckCircle2, Clock, MapPin, PartyPopper, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { capitalise, getStudioAddress } from '@fizz-kidz/core'
import type { Invitations } from '@fizz-kidz/core'

import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import { Separator } from '@shared/components/ui/separator'
import { useRouterState } from '@shared/hooks/use-router-state'
import { cn } from '@shared/lib/tailwind'

import { Navbar } from '../navbar'
import { Result } from '../result'
import { RsvpForm } from '../rsvp-form'

export function RsvpPage() {
    const { id } = useParams()
    const state = useRouterState<{ invitation: Invitations.Invitation }>()

    const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'not-attending' | null>(null)

    if (!state) {
        return <Navigate to={`/invite/${id}`} />
    }

    const { invitation } = state

    const address = invitation.$type === 'mobile' ? invitation.address : getStudioAddress(invitation.studio)
    const formattedDate = format(invitation.date, 'EEEE, MMM d, yyyy')

    return (
        <div className="twp min-h-screen bg-gradient-to-br from-[#F7F1FF] via-white to-[#EAF6FF]">
            <Navbar />
            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
                {rsvpStatus === null ? (
                    <>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#9B3EEA] shadow-sm">
                                <PartyPopper className="h-4 w-4" />
                                RSVP to the party
                            </div>
                            <p className="font-lilita text-4xl text-slate-900 sm:text-5xl">
                                {invitation.childName}&apos;s {invitation.childAge}th Birthday
                            </p>
                            <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                                Let {invitation.childName}&apos;s family know if you can join the celebrations. It only
                                takes a moment.
                            </p>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                            <Card className="border border-white/70 bg-white/80 shadow-md backdrop-blur">
                                <CardContent className="space-y-4 p-5 sm:p-6">
                                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#9B3EEA]">
                                        <Sparkles className="h-4 w-4" />
                                        Event details
                                    </div>
                                    <DetailRow
                                        icon={<Clock />}
                                        label="Date & time"
                                        value={`${formattedDate} · ${invitation.time}`}
                                    />
                                    <DetailRow
                                        icon={<MapPin />}
                                        label="Location"
                                        value={
                                            invitation.$type === 'studio'
                                                ? `Fizz Kidz ${capitalise(invitation.studio)} Studio • ${address}`
                                                : address
                                        }
                                    />
                                    <Separator />
                                    <p className="text-sm text-slate-600">
                                        Please share any allergies or notes so we can make sure everyone has a great
                                        time.
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="w-full rounded-xl border-slate-200 text-sm font-semibold"
                                        onClick={() => window.history.back()}
                                    >
                                        Back to invitation
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="border border-white/70 bg-white/80 shadow-md backdrop-blur">
                                <CardContent className="p-5 sm:p-6">
                                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#9B3EEA]">
                                        RSVP form
                                    </p>
                                    <p className="text-lg font-semibold text-slate-900">Tell us who&apos;s coming</p>
                                    <p className="mb-4 text-sm text-slate-600">
                                        You can include multiple invited children in one response.
                                    </p>
                                    <RsvpForm invitation={invitation} onComplete={setRsvpStatus} />
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : (
                    <Card className="mx-auto w-full max-w-2xl border border-white/70 bg-white/80 shadow-md backdrop-blur">
                        <CardContent className="space-y-4 p-6 text-center sm:p-8">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                <CheckCircle2 className="h-7 w-7" />
                            </div>
                            <Result rsvp={rsvpStatus} invitation={invitation} />
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

function DetailRow({
    icon,
    label,
    value,
    muted,
}: {
    icon: React.ReactNode
    label: string
    value?: string
    muted?: boolean
}) {
    if (!value) return null
    return (
        <div className={cn('flex items-start gap-3 rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm')}>
            <div className="mt-0.5 text-[#9B3EEA]">{icon}</div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                <p className={cn('text-sm font-semibold text-slate-900', muted && 'text-slate-600')}>{value}</p>
            </div>
        </div>
    )
}
