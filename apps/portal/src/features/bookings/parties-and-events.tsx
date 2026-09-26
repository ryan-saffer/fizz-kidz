import { Toaster } from 'sonner'

import type { FirestoreBooking, StandardEvent, WithId } from '@fizz-kidz/core'
import { ObjectKeys, capitalise } from '@fizz-kidz/core'

import { useOrg } from '@session/use-org'
import { Skeleton } from '@shared/components/ui/skeleton'
import { getOrgName } from '@shared/lib/studio-utils'

import EventPanel from './events/event-panel'
import { useEvents } from './events/use-events'
import { useLocationFilter } from './location-filter/location-filter.hook'
import { PartyBookingCard } from './parties/components/party-booking-card'
import { usePartyBookings } from './parties/hooks/use-party-bookings'

export const PartiesAndEvents = () => {
    const { selectedLocation } = useLocationFilter()

    const bookings = usePartyBookings()
    const events = useEvents('standard')

    const { currentOrg } = useOrg()
    const loading = bookings.status === 'loading' || events.status === 'loading'

    return (
        <>
            <Toaster richColors />
            {loading && [1, 2].map((idx) => <BookingsSkeleton key={idx} />)}
            {bookings.status === 'loaded' && events.status === 'loaded' && !loading && (
                <div className="flex flex-col gap-6 pt-4">
                    {currentOrg === 'master' ? (
                        ObjectKeys(bookings.result).map(
                            (location) =>
                                (selectedLocation === location || selectedLocation === 'all') && (
                                    <LocationBookings
                                        key={location}
                                        name={`${capitalise(location)} Studio`}
                                        bookings={bookings.result[location]}
                                        events={events.result[location]}
                                    />
                                )
                        )
                    ) : (
                        <LocationBookings
                            name={getOrgName(currentOrg!)}
                            bookings={bookings.result[currentOrg!]}
                            events={events.result[currentOrg!]}
                        />
                    )}
                </div>
            )}
        </>
    )
}

// a calendar event links to `?id=<bookingId>`, which opens that booking
const linkedBookingId = () => new URLSearchParams(window.location.search).get('id')

const LocationBookings = ({
    name,
    bookings,
    events,
}: {
    name: string
    bookings: WithId<FirestoreBooking>[]
    events: StandardEvent[]
}) => {
    const sortedBookings = [...bookings].sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis())

    return (
        <section className="flex flex-col gap-3">
            <h2 className="m-0 font-lilita text-2xl font-normal text-slate-900">{name}</h2>
            {bookings.length === 0 && events.length === 0 && (
                <p className="m-0 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm text-slate-500">
                    No bookings on this day
                </p>
            )}
            {sortedBookings.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Parties · {sortedBookings.length}
                    </h3>
                    {sortedBookings.map((booking) => (
                        <PartyBookingCard
                            key={booking.id}
                            booking={booking}
                            defaultOpen={booking.id === linkedBookingId()}
                        />
                    ))}
                </div>
            )}
            {events.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Events</h3>
                    {events.map((event) => (
                        <EventPanel key={event.id} event={event} />
                    ))}
                </div>
            )}
        </section>
    )
}

const BookingsSkeleton = () => (
    <div className="twp flex flex-col gap-2 pt-6">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
    </div>
)
