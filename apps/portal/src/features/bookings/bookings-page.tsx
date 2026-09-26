import { CalendarPlus, ChevronDown, PartyPopper, Ticket } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@shared/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu'
import { cn } from '@shared/lib/tailwind'

import { DateNavigation } from './date-navigation/date-navigation'
import Incursions from './events/incursions'
import { FilterContextProvider } from './location-filter/location-filter.provider'
import NewEventDialog from './new-event-dialog'
import { PartiesAndEvents } from './parties-and-events'
import { PartyBookingDialog } from './parties/components/party-booking-dialog'
import { getPartyBookingPrefill } from './parties/state/party-booking-form'
import { usePartyBookingsStore } from './parties/state/party-bookings-store'

type Tab = 'parties' | 'incursions'

const TABS: { value: Tab; label: string }[] = [
    { value: 'parties', label: 'Parties & Events' },
    { value: 'incursions', label: 'Incursions' },
]

const getSearchParams = () =>
    typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)

export const BookingsPage = () => {
    const [openNewEvent, setOpenNewEvent] = useState(() => getSearchParams().get('bookingType') === 'event')
    const [selectedTab, setSelectedTab] = useState<Tab>(() => {
        const params = getSearchParams()
        return params.get('bookingType') === 'event' && params.get('eventType')?.trim().toLowerCase() === 'incursion'
            ? 'incursions'
            : 'parties'
    })

    // a CRM link can prefill a new party booking
    useEffect(() => {
        const params = getSearchParams()
        if (params.get('bookingType') === 'event') return
        const prefill = getPartyBookingPrefill(params)
        if (prefill) usePartyBookingsStore.getState().openCreate(prefill)
    }, [])

    return (
        <FilterContextProvider>
            <DateNavigation
                label="Bookings"
                action={
                    <NewBookingMenu
                        onNewParty={() => usePartyBookingsStore.getState().openCreate()}
                        onNewEvent={() => setOpenNewEvent(true)}
                    />
                }
            >
                <div className="twp mt-4 flex gap-2">
                    {TABS.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            aria-pressed={selectedTab === tab.value}
                            className={cn(
                                'rounded-full border bg-white px-4 py-2 text-sm font-medium transition-colors',
                                selectedTab === tab.value
                                    ? 'border-fizz-purple-dark text-fizz-purple-dark'
                                    : 'border-transparent text-slate-700 hover:border-slate-300'
                            )}
                            onClick={() => setSelectedTab(tab.value)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                {selectedTab === 'parties' && <PartiesAndEvents />}
                {selectedTab === 'incursions' && <Incursions />}
                <PartyBookingDialog />
                <NewEventDialog open={openNewEvent} onClose={() => setOpenNewEvent(false)} />
            </DateNavigation>
        </FilterContextProvider>
    )
}

function NewBookingMenu({ onNewParty, onNewEvent }: { onNewParty: () => void; onNewEvent: () => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="twp" variant="outline">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    New Booking
                    <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="twp z-[1302]">
                <DropdownMenuItem onClick={onNewParty}>
                    <PartyPopper className="mr-2 h-4 w-4" />
                    Party
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onNewEvent}>
                    <Ticket className="mr-2 h-4 w-4" />
                    Event
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
