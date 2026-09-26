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
        <article className="twp overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={detailsId}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 sm:gap-4 sm:px-4"
                onClick={() => setOpen((value) => !value)}
            >
                <span className="block w-[5.5rem] shrink-0 text-sm font-semibold tabular-nums text-slate-900 sm:w-[6.5rem]">
                    {times.start}
                    <span className="block text-xs font-normal text-slate-500">to {times.end}</span>
                </span>
                <span className="block min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">
                        {getPartyBirthdayChildDisplay(booking)}
                    </span>
                    <span className="block truncate text-sm text-slate-500">
                        {booking.parentFirstName} {booking.parentLastName}
                    </span>
                </span>
                <span className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                    <PartyTags booking={booking} />
                </span>
                <ChevronDown
                    className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
                />
            </button>
            <div className="flex flex-wrap gap-1.5 px-3 pb-3 sm:hidden">
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
    return <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', className)}>{children}</span>
}
