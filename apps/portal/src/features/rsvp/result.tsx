import { CalendarDays, MapPin, PartyPopper, Sparkles } from 'lucide-react'

import type { Invitations } from '@fizz-kidz/core'
import { capitalise, getStudioAddress } from '@fizz-kidz/core'

export function Result({
    rsvp,
    invitation,
}: {
    rsvp: 'attending' | 'not-attending'
    invitation: Invitations.Invitation
}) {
    const address = invitation.$type === 'mobile' ? invitation.address : getStudioAddress(invitation.studio)

    const heading = rsvp === 'attending' ? "Yay! We can't wait to see you there." : "We're sorry you can't make it!"

    const locationLine =
        rsvp === 'attending' && invitation.$type === 'studio'
            ? `Fizz Kidz ${capitalise(invitation.studio)} Studio • ${address}`
            : rsvp === 'attending'
              ? address
              : undefined

    return (
        <div className="flex flex-col items-center gap-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-[#9B3EEA]">
                <PartyPopper className="h-4 w-4" />
                RSVP received
            </div>
            <p className="font-lilita text-3xl text-slate-900 sm:text-4xl">{heading}</p>
            <p className="text-sm text-slate-600 sm:text-base">
                If plans change, just let {invitation.parentName} know so they can update your RSVP.
            </p>
            <div className="mt-2 grid w-full max-w-md gap-2 sm:grid-cols-2">
                {locationLine && <Pill icon={<MapPin />} label="Location" value={locationLine} fullWidth />}
                <Pill icon={<CalendarDays />} label="Date" value={invitation.date.toDateString()} />
                <Pill icon={<Sparkles />} label="Time" value={invitation.time} />
            </div>
        </div>
    )
}

function Pill({
    icon,
    label,
    value,
    fullWidth,
}: {
    icon: React.ReactNode
    label: string
    value?: string
    fullWidth?: boolean
}) {
    if (!value) return null
    return (
        <div
            className={`flex items-center gap-2 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm ${
                fullWidth ? 'sm:col-span-2' : ''
            }`}
        >
            <span className="text-[#9B3EEA]">{icon}</span>
            <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-slate-900">{value}</p>
            </div>
        </div>
    )
}
