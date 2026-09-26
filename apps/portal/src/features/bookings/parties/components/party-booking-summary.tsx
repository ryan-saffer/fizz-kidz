import { useQuery } from '@tanstack/react-query'
import {
    CalendarClock,
    CheckCircle2,
    Circle,
    Mail,
    MapPin,
    NotebookPen,
    PartyPopper,
    Phone,
    UtensilsCrossed,
} from 'lucide-react'

import { capitalise } from '@fizz-kidz/core'
import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { cn } from '@shared/lib/tailwind'

import {
    getAdditionNames,
    getBirthdayChildren,
    getCreationNames,
    getPartyDate,
    getPartyLengthLabel,
    getPartyTimes,
    getPurchasedGoodies,
} from '../utils/display'
import { PartyBookingActions } from './party-booking-actions'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** A booking at a glance, in three sections: the party itself, its food, and notes. */
export function PartyBookingSummary({ booking }: { booking: WithId<FirestoreBooking> }) {
    return (
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-3 sm:p-4">
            <PartyBookingActions booking={booking} />
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                <PartyDetails booking={booking} />
                <div className="flex flex-col gap-3">
                    <Food booking={booking} />
                    <Notes booking={booking} />
                </div>
            </div>
        </div>
    )
}

function PartyDetails({ booking }: { booking: FirestoreBooking }) {
    const trpc = useTRPC()
    const { data: catalogue } = useQuery(trpc.creations.getBirthdayPartyBookingCatalogue.queryOptions())
    const times = getPartyTimes(booking)
    const creations = getCreationNames(booking, catalogue)

    return (
        <Section
            tone="party"
            icon={PartyPopper}
            title="Party details"
            status={
                booking.partyFormFilledIn ? (
                    <Pill className="bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Party form done
                    </Pill>
                ) : (
                    <Pill className="bg-white text-slate-600 ring-1 ring-slate-200">
                        <Circle className="h-3.5 w-3.5" /> Party form not done
                    </Pill>
                )
            }
        >
            <Subsection tone="party" title="When & where">
                <IconLine icon={CalendarClock}>
                    <span className="font-medium">{getPartyDate(booking)}</span>
                    <span className="block text-slate-600">
                        {times.start} – {times.end} · {getPartyLengthLabel(booking.partyLength)}
                    </span>
                </IconLine>
                <IconLine icon={MapPin}>
                    {booking.type === 'mobile'
                        ? booking.address || 'Mobile party'
                        : `${capitalise(booking.location)} studio`}
                </IconLine>
            </Subsection>

            <Subsection tone="party" title="Parent">
                <p className="font-semibold text-slate-900">
                    {booking.parentFirstName} {booking.parentLastName}
                </p>
                <IconLine icon={Mail}>
                    <a className="break-all text-violet-700 hover:underline" href={`mailto:${booking.parentEmail}`}>
                        {booking.parentEmail}
                    </a>
                </IconLine>
                <IconLine icon={Phone}>
                    <a className="text-violet-700 hover:underline" href={`tel:${booking.parentMobile}`}>
                        {booking.parentMobile}
                    </a>
                </IconLine>
            </Subsection>

            <Subsection tone="party" title="Children">
                <div className="flex flex-wrap gap-2">
                    {getBirthdayChildren(booking).map((child, index) => (
                        <span
                            key={index}
                            className="inline-flex items-baseline gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-sm ring-1 ring-violet-100"
                        >
                            <span className="font-semibold text-slate-900">{child.name}</span>
                            <span className="text-violet-700">turning {child.age}</span>
                        </span>
                    ))}
                </div>
                <p className="text-sm text-slate-600">
                    {booking.numberOfChildren ? (
                        <>
                            <span className="font-semibold text-slate-900">{booking.numberOfChildren}</span> children
                            coming
                        </>
                    ) : (
                        'Number of children not confirmed yet'
                    )}
                </p>
            </Subsection>

            <Subsection tone="party" title="Creations">
                {creations.length > 0 ? (
                    <ol className="flex flex-col gap-1.5">
                        {creations.map((creation, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                                    {index + 1}
                                </span>
                                {creation}
                            </li>
                        ))}
                    </ol>
                ) : (
                    <Empty>Not chosen yet</Empty>
                )}
            </Subsection>
        </Section>
    )
}

function Food({ booking }: { booking: FirestoreBooking }) {
    const additions = booking.type === 'studio' ? getAdditionNames(booking) : []
    const goodies = getPurchasedGoodies(booking)

    return (
        <Section
            tone="food"
            icon={UtensilsCrossed}
            title="Food"
            status={
                booking.type === 'mobile' ? (
                    <Pill className="bg-white text-slate-600 ring-1 ring-slate-200">Mobile party</Pill>
                ) : booking.includesFood ? (
                    <Pill className="bg-emerald-100 text-emerald-800">Food package included</Pill>
                ) : (
                    <Pill className="bg-rose-100 text-rose-800">Self-catered</Pill>
                )
            }
        >
            {booking.type === 'studio' && (
                <Subsection
                    tone="food"
                    title="Food additions"
                    status={additions.length > 0 && <PayStatus paid={false} />}
                >
                    {additions.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                            {additions.map((addition) => (
                                <li
                                    key={addition}
                                    className="rounded-md bg-amber-50 px-2 py-1 text-sm font-medium text-amber-900 ring-1 ring-amber-200"
                                >
                                    {addition}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty>No additions</Empty>
                    )}
                </Subsection>
            )}

            <Subsection tone="food" title="Cake" status={booking.cake && <PayStatus paid />}>
                {booking.cake ? (
                    <>
                        <p className="font-semibold text-slate-900">{booking.cake.selection}</p>
                        <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-sm">
                            <CakeDetail label="Size">{booking.cake.size}</CakeDetail>
                            <CakeDetail label="Flavours">{booking.cake.flavours.join(', ')}</CakeDetail>
                            <CakeDetail label="Served">{booking.cake.served}</CakeDetail>
                            <CakeDetail label="Candles">{booking.cake.candles}</CakeDetail>
                            {booking.cake.message && <CakeDetail label="Message">“{booking.cake.message}”</CakeDetail>}
                        </dl>
                    </>
                ) : (
                    <Empty>No cake ordered</Empty>
                )}
            </Subsection>

            {goodies.length > 0 && (
                <Subsection tone="food" title="Take-home goodies" status={<PayStatus paid />}>
                    <ul className="flex flex-col gap-1 text-sm text-slate-900">
                        {goodies.map((goodie) => (
                            <li key={goodie.name}>
                                <span className="font-semibold tabular-nums">{goodie.quantity} ×</span> {goodie.name}
                            </li>
                        ))}
                    </ul>
                </Subsection>
            )}
        </Section>
    )
}

function Notes({ booking }: { booking: FirestoreBooking }) {
    const hasNotes = booking.notes || booking.questions || booking.funFacts

    return (
        <Section tone="notes" icon={NotebookPen} title="Notes">
            {!hasNotes && (
                <Subsection tone="notes">
                    <Empty>No notes yet</Empty>
                </Subsection>
            )}
            {booking.notes && (
                <Subsection tone="notes" title="Staff notes">
                    <p className="whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-900 ring-1 ring-amber-200">
                        {booking.notes}
                    </p>
                </Subsection>
            )}
            {booking.questions && (
                <Subsection tone="notes" title="Parent questions">
                    <p className="whitespace-pre-wrap text-sm text-slate-900">{booking.questions}</p>
                </Subsection>
            )}
            {booking.funFacts && (
                <Subsection tone="notes" title="Fun facts">
                    <p className="whitespace-pre-wrap text-sm text-slate-900">{booking.funFacts}</p>
                </Subsection>
            )}
        </Section>
    )
}

const TONES = {
    party: {
        header: 'bg-violet-50 border-violet-100',
        icon: 'bg-violet-600',
        title: 'text-violet-950',
        label: 'text-violet-700',
    },
    food: {
        header: 'bg-amber-50 border-amber-100',
        icon: 'bg-amber-500',
        title: 'text-amber-950',
        label: 'text-amber-700',
    },
    notes: { header: 'bg-sky-50 border-sky-100', icon: 'bg-sky-500', title: 'text-sky-950', label: 'text-sky-700' },
}

type Tone = keyof typeof TONES

function Section({
    tone,
    icon: Icon,
    title,
    status,
    className,
    children,
}: {
    tone: Tone
    icon: LucideIcon
    title: string
    status?: ReactNode
    className?: string
    children: ReactNode
}) {
    const colours = TONES[tone]
    return (
        <section className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
            <header className={cn('flex flex-wrap items-center gap-2.5 border-b px-4 py-3', colours.header)}>
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-white', colours.icon)}>
                    <Icon className="h-4 w-4" />
                </span>
                <h4 className={cn('flex-1 text-base font-bold', colours.title)}>{title}</h4>
                {status}
            </header>
            <div className="divide-y divide-slate-100">{children}</div>
        </section>
    )
}

function Subsection({
    tone,
    title,
    status,
    children,
}: {
    tone: Tone
    title?: string
    status?: ReactNode
    children: ReactNode
}) {
    return (
        <div className="flex flex-col gap-2 px-4 py-3">
            {title && (
                <div className="flex items-center justify-between gap-2">
                    <h5 className={cn('text-xs font-bold uppercase tracking-wider', TONES[tone].label)}>{title}</h5>
                    {status}
                </div>
            )}
            {children}
        </div>
    )
}

function IconLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
    return (
        <div className="flex items-start gap-2 text-sm text-slate-900">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">{children}</div>
        </div>
    )
}

function CakeDetail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-slate-900">{children}</dd>
        </>
    )
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
    return (
        <span
            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', className)}
        >
            {children}
        </span>
    )
}

function PayStatus({ paid }: { paid: boolean }) {
    return paid ? (
        <Pill className="bg-emerald-100 text-emerald-800">Paid</Pill>
    ) : (
        <Pill className="bg-rose-100 text-rose-800">Pay at party</Pill>
    )
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="text-sm text-slate-400">{children}</p>
}
