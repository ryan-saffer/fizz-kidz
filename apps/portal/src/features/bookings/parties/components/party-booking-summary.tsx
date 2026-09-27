import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock3, NotebookPen, PartyPopper, UtensilsCrossed } from 'lucide-react'

import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { cn } from '@shared/lib/tailwind'

import { getAdditionNames, getBirthdayChildren, getCreationNames, getPurchasedGoodies } from '../utils/display'
import { PartyBookingActions } from './party-booking-actions'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function PartyBookingSummary({ booking }: { booking: WithId<FirestoreBooking> }) {
    return (
        <div className="space-y-3 border-t border-slate-300 bg-white p-3 text-sm leading-5 text-slate-900 [overflow-wrap:anywhere] sm:p-4">
            <PartyDetails booking={booking} />
            <Food booking={booking} />
            <Notes booking={booking} />
            <PartyBookingActions booking={booking} />
        </div>
    )
}

function PartyDetails({ booking }: { booking: FirestoreBooking }) {
    const trpc = useTRPC()
    const { data: catalogue } = useQuery(trpc.creations.getBirthdayPartyBookingCatalogue.queryOptions())
    const children = getBirthdayChildren(booking)
    const creations = getCreationNames(booking, catalogue)
    const FormIcon = booking.partyFormFilledIn ? CheckCircle2 : Clock3

    return (
        <Section
            icon={PartyPopper}
            title="Party details"
            iconClassName="text-violet-600"
            headerClassName="border-violet-200 bg-violet-50"
            status={
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold ring-1 ring-inset',
                        booking.partyFormFilledIn
                            ? 'bg-emerald-100 text-emerald-900 ring-emerald-200'
                            : 'bg-amber-100 text-amber-900 ring-amber-200'
                    )}
                >
                    <FormIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {booking.partyFormFilledIn ? 'Party form done' : 'Party form not done'}
                </span>
            }
        >
            <dl className="divide-y divide-slate-100">
                <Detail label={children.length > 1 ? 'Birthday children' : 'Birthday child'}>
                    {children.map((child, index) => (
                        <div key={index} className="flex flex-wrap items-baseline gap-x-2">
                            <p className="text-base font-semibold">{child.name}</p>
                            <p className="font-medium text-violet-700">turning {child.age}</p>
                        </div>
                    ))}
                </Detail>
                <Detail label="Parent">
                    <p className="text-base font-semibold">
                        {booking.parentFirstName} {booking.parentLastName}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-600">
                        <a className="hover:text-violet-700 hover:underline" href={`tel:${booking.parentMobile}`}>
                            {booking.parentMobile}
                        </a>
                        <a className="hover:text-violet-700 hover:underline" href={`mailto:${booking.parentEmail}`}>
                            {booking.parentEmail}
                        </a>
                    </div>
                </Detail>
                <Detail label="Number of children">
                    {booking.numberOfChildren ? (
                        <p className="text-base font-semibold tabular-nums">{booking.numberOfChildren}</p>
                    ) : (
                        <Empty>Not confirmed yet</Empty>
                    )}
                </Detail>
                <Detail label="Creations">
                    {creations.length > 0 ? (
                        <ol className="space-y-1">
                            {creations.map((creation, index) => (
                                <li key={index} className="flex items-baseline gap-2 font-semibold">
                                    <span className="text-xs font-medium tabular-nums text-violet-600">
                                        {index + 1}.
                                    </span>
                                    {creation}
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <Empty>Not chosen yet</Empty>
                    )}
                </Detail>
                {booking.type === 'mobile' && (
                    <Detail label="Party address">{booking.address || <Empty>No address yet</Empty>}</Detail>
                )}
            </dl>
        </Section>
    )
}

function Food({ booking }: { booking: FirestoreBooking }) {
    const additions = booking.type === 'studio' ? getAdditionNames(booking) : []
    const goodies = getPurchasedGoodies(booking)
    const cake = booking.cake

    return (
        <Section
            icon={UtensilsCrossed}
            title="Food & extras"
            iconClassName="text-blue-600"
            headerClassName="border-blue-200 bg-blue-50"
            status={
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold ring-1 ring-inset',
                        booking.type === 'mobile'
                            ? 'bg-slate-100 text-slate-700 ring-slate-200'
                            : booking.includesFood
                              ? 'bg-emerald-100 text-emerald-900 ring-emerald-200'
                              : 'bg-amber-100 text-amber-900 ring-amber-200'
                    )}
                >
                    {booking.type === 'studio' && booking.includesFood && (
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    {booking.type === 'mobile'
                        ? 'Mobile party'
                        : booking.includesFood
                          ? 'Food package included'
                          : 'Self-catered'}
                </span>
            }
        >
            <dl className="divide-y divide-slate-100">
                {booking.type === 'studio' && (
                    <>
                        <Detail label="Food additions">
                            {additions.length > 0 ? (
                                <>
                                    <ul className="space-y-1 font-semibold">
                                        {additions.map((addition, index) => (
                                            <li key={index}>{addition}</li>
                                        ))}
                                    </ul>
                                    <p className="mt-0.5 text-xs text-amber-800">Pay at party</p>
                                </>
                            ) : (
                                <Empty>None ordered</Empty>
                            )}
                        </Detail>
                        <Detail label="Cake">
                            {cake ? (
                                <>
                                    <p className="font-medium">
                                        {cake.selection} <Paid />
                                    </p>
                                    <p className="text-slate-600">
                                        {[cake.size, cake.flavours.join(', '), cake.served, cake.candles]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                    {cake.message && <p className="text-slate-600">Message: {cake.message}</p>}
                                </>
                            ) : (
                                <Empty>None ordered</Empty>
                            )}
                        </Detail>
                    </>
                )}
                {(booking.type === 'studio' || goodies.length > 0) && (
                    <Detail label="Take-home items">
                        {goodies.length > 0 ? (
                            <div>
                                <ul>
                                    {goodies.map((goodie) => (
                                        <li key={goodie.name}>
                                            <span className="mr-1 font-semibold tabular-nums">{goodie.quantity} ×</span>
                                            <span>{goodie.name}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Paid />
                            </div>
                        ) : (
                            <Empty>None ordered</Empty>
                        )}
                    </Detail>
                )}
            </dl>
            {booking.type === 'mobile' && (
                <p className="px-3 py-2.5 text-slate-500 sm:px-4">No food package for mobile parties</p>
            )}
        </Section>
    )
}

function Notes({ booking }: { booking: FirestoreBooking }) {
    const notes = [
        { label: 'Staff notes', text: booking.notes },
        { label: 'Fun facts', text: booking.funFacts },
        { label: 'Parent questions', text: booking.questions },
    ].filter((note) => note.text?.trim())

    return (
        <Section
            icon={NotebookPen}
            title="Notes & fun facts"
            iconClassName="text-amber-700"
            headerClassName="border-amber-200 bg-amber-50"
        >
            {notes.length > 0 ? (
                <dl className="divide-y divide-slate-100">
                    {notes.map((note) => (
                        <Detail key={note.label} label={note.label}>
                            <p className="whitespace-pre-wrap font-medium">{note.text}</p>
                        </Detail>
                    ))}
                </dl>
            ) : (
                <p className="px-3 py-2.5 sm:px-4">
                    <Empty>No notes yet</Empty>
                </p>
            )}
        </Section>
    )
}

function Section({
    icon: Icon,
    title,
    status,
    iconClassName,
    headerClassName,
    children,
}: {
    icon: LucideIcon
    title: string
    status?: ReactNode
    iconClassName: string
    headerClassName: string
    children: ReactNode
}) {
    return (
        <section className="overflow-hidden rounded-lg border border-slate-300 bg-white">
            <header
                className={cn(
                    'flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-3 py-2.5 sm:px-4',
                    headerClassName
                )}
            >
                <h4 className="flex items-center gap-2 text-base font-bold">
                    <Icon aria-hidden="true" className={cn('h-4 w-4', iconClassName)} />
                    {title}
                </h4>
                {status}
            </header>
            {children}
        </section>
    )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-x-3 px-3 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-4 sm:px-4">
            <dt className="font-bold text-slate-700">{label}</dt>
            <dd className="min-w-0">{children}</dd>
        </div>
    )
}

function Paid() {
    return <span className="text-xs font-medium text-emerald-700">Paid</span>
}

function Empty({ children }: { children: ReactNode }) {
    return <span className="text-sm text-slate-500">{children}</span>
}
