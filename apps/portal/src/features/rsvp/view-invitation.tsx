import { format } from 'date-fns'
import { Clock, MapPin, PartyPopper, Sparkles, User } from 'lucide-react'
import { Img } from 'react-image'
import { useLocation, useNavigate } from 'react-router-dom'

import { capitalise } from '@fizz-kidz/core'

import Loader from '@shared/components/loader'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/lib/tailwind'

import { useInvitation } from './hooks/use-invitation'
import { useInvitationImage } from './hooks/use-invitation-image'

export function ViewInvitation() {
    const navigate = useNavigate()
    const location = useLocation()

    const invitation = useInvitation()
    const invitationUrl = useInvitationImage(invitation.id, false)

    const formattedDate = format(invitation.date, 'EEEE, MMM d, yyyy')
    const time = invitation.time
    const address =
        invitation.$type === 'studio'
            ? `${invitation.studio ? capitalise(invitation.studio) : 'Fizz Kidz'} studio`
            : invitation.address

    return (
        <div className="twp min-h-screen bg-gradient-to-br from-[#F7F1FF] via-white to-[#EAF6FF] pb-24">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#9B3EEA] shadow-sm">
                        <Sparkles className="h-4 w-4" />
                        You're invited!
                    </div>
                    <p className="font-lilita text-4xl text-slate-900 sm:text-5xl">
                        {invitation.childName}'s {invitation.childAge}th Birthday
                    </p>
                    <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                        We'd love to celebrate with you. Check the details below and let us know if you can make it.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.25fr_0.85fr]">
                    <Card className="overflow-hidden border border-white/70 bg-white/80 shadow-xl backdrop-blur">
                        <CardContent className="p-4 sm:p-6">
                            <div className="rounded-2xl bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4">
                                <Img
                                    src={invitationUrl}
                                    loader={<Loader className="my-12" />}
                                    className="mx-auto max-h-[80vh] w-full max-w-[1100px] rounded-xl border border-slate-100 object-contain shadow"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-white/70 bg-white/80 shadow-xl backdrop-blur">
                        <CardContent className="space-y-4 p-5 sm:p-6">
                            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#9B3EEA]">
                                <PartyPopper className="h-4 w-4" />
                                Party details
                            </div>
                            <DetailRow icon={<Sparkles />} label="Birthday star" value={invitation.childName} />
                            <DetailRow icon={<Clock />} label="Date & time" value={`${formattedDate} · ${time}`} />
                            <DetailRow icon={<MapPin />} label="Location" value={address} />
                            <DetailRow icon={<User />} label="Hosted by" value={invitation.parentName} />
                            <Separator />
                            <p className="text-sm text-slate-600">
                                Please RSVP so we can plan snacks, activities, and any allergy-friendly options.
                            </p>
                            <Button
                                className="w-full rounded-xl bg-[#9B3EEA] font-semibold shadow-lg hover:bg-[#8B2DE3]"
                                onClick={() => navigate('rsvp', { state: { invitation } })}
                            >
                                RSVP to {invitation.childName}'s party
                            </Button>
                            <p className="text-xs text-slate-600">
                                Already RSVP'd? You should have an email confirmation with your RSVP. In order to change
                                your response, let the party host know and they can update it for you.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-5 text-center text-sm text-slate-600 shadow sm:px-6">
                    <div className="flex items-center gap-2 text-[#9B3EEA]">
                        <Sparkles className="h-4 w-4" />
                        <span className="font-semibold">Are you the party host?</span>
                    </div>
                    <p className="max-w-3xl">Sign in to view and manage RSVP responses for this invitation.</p>
                    <Button
                        variant="outline"
                        className="mt-1 rounded-xl border-slate-200 font-semibold text-[#9B3EEA] hover:border-[#9B3EEA] hover:bg-[#9B3EEA]/10 hover:text-[#9B3EEA]"
                        onClick={() =>
                            navigate(`/sign-in?returnTo=${encodeURIComponent(location.pathname + location.search)}`)
                        }
                    >
                        Sign in to manage RSVPs
                    </Button>
                </div>
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
