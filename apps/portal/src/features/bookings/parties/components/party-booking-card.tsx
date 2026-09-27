import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { getPartyBirthdayChildDisplay } from '@fizz-kidz/core'
import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import { cn } from '@shared/lib/tailwind'

import { getPartyTimes } from '../utils/display'
import { PartyBookingSummary } from './party-booking-summary'

/** A party on the day's list. Opens to show its details and actions. */
export function PartyBookingCard({
    booking,
    defaultOpen = false,
}: {
    booking: WithId<FirestoreBooking>
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    const times = getPartyTimes(booking)
    const detailsId = `party-${booking.id}`

    return (
        <article
            className={cn(
                'twp overflow-hidden rounded-xl border bg-white shadow-sm transition-colors',
                open ? 'border-slate-400 ring-1 ring-slate-200' : 'border-slate-300'
            )}
        >
            <button
                type="button"
                aria-expanded={open}
                aria-controls={detailsId}
                className={cn(
                    'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-600 sm:gap-4 sm:px-4',
                    open ? 'bg-slate-50 hover:bg-slate-100' : 'hover:bg-slate-50'
                )}
                onClick={() => setOpen((value) => !value)}
            >
                <span className="block w-[6rem] shrink-0 text-base font-semibold tabular-nums text-slate-900 sm:w-[7rem]">
                    {times.start}
                    <span className="block text-sm font-normal text-slate-600">to {times.end}</span>
                </span>
                <span className="block min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold text-slate-900">
                        {getPartyBirthdayChildDisplay(booking)}
                    </span>
                    <span className="block truncate text-base text-slate-600">
                        {booking.parentFirstName} {booking.parentLastName}
                    </span>
                </span>
                <span className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                    <PartyTags booking={booking} />
                </span>
                <span
                    className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
                        open ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-600'
                    )}
                >
                    <ChevronDown
                        aria-hidden="true"
                        className={cn('h-5 w-5 transition-transform', open && 'rotate-180')}
                    />
                </span>
            </button>
            <div className={cn('flex flex-wrap gap-1.5 px-3 pb-3 sm:hidden', open && 'bg-slate-50')}>
                <PartyTags booking={booking} />
            </div>
            {open && (
                <div id={detailsId}>
                    <PartyBookingSummary booking={booking} />
                </div>
            )}
        </article>
    )
}

function PartyTags({ booking }: { booking: FirestoreBooking }) {
    return (
        <>
            {booking.payment && <Tag className="bg-emerald-100 text-emerald-800">Paid</Tag>}
            {booking.oldPrices && <Tag className="bg-orange-100 text-orange-800">Old prices</Tag>}
            {booking.type === 'studio' && !booking.includesFood && (
                <Tag className="bg-rose-100 text-rose-800">Self-catered</Tag>
            )}
            <Tag className={booking.type === 'studio' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'}>
                {booking.type === 'studio' ? 'Studio' : 'Mobile'}
            </Tag>
        </>
    )
}

function Tag({ className, children }: { className: string; children: React.ReactNode }) {
    return <span className={cn('rounded-full px-2.5 py-1 text-sm font-medium', className)}>{children}</span>
}
