import { collectionGroup, getDocs, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import type { Event, IncursionEvent, Service, StandardEvent, Studio } from '@fizz-kidz/core'
import { STUDIOS } from '@fizz-kidz/core'

import { convertTimestamps } from '@integrations/firebase/converters'
import useFirebase from '@integrations/firebase/use-firebase'
import { useOrg } from '@session/use-org'

import { useDateNavigation } from '../date-navigation/date-navigation.hooks'

export function useEvents<T extends Event['$type']>(
    type: T
): Service<Record<Studio, T extends 'standard' ? StandardEvent[] : IncursionEvent[]>> {
    const firebase = useFirebase()

    const { date } = useDateNavigation()
    const [events, setEvents] = useState<Service<Record<Studio, Event[]>>>({ status: 'loading' })

    const { currentOrg } = useOrg()

    const generateLocationsMap = (events: Event[]): Record<Studio, Event[]> =>
        STUDIOS.reduce((acc, curr) => ({ ...acc, [curr]: events.filter((it) => it.studio === curr) }), {} as any)

    useEffect(() => {
        async function fetchEvents() {
            setEvents({ status: 'loading' })
            // since we need to get a range between startDate and endDate,
            // and firestore does not support equality operators '>', '<' on multiple fields,
            // fetch all events that may have already started, and filter the rest on the frontend
            const nextDay = date.plus({ days: 1 })
            // an event will never be 90 days long, so a safe window
            const ninetyDaysAgo = date.minus({ days: 90 })

            const constraints = [
                where('$type', '==', type),
                where('startTime', '<', nextDay.toJSDate()),
                where('startTime', '>', ninetyDaysAgo.toJSDate()),
            ]

            if (currentOrg !== 'master') {
                constraints.push(where('studio', '==', currentOrg))
            }

            const eventsQuery = query(collectionGroup(firebase.db, 'eventSlots'), ...constraints)
            const snap = await getDocs(eventsQuery)

            try {
                const events = snap.docs
                    .map((doc) => {
                        const data = doc.data()
                        if (data) {
                            const event = convertTimestamps(data) as Event
                            if (event.endTime > date.toJSDate()) {
                                return event
                            }
                        }
                        return null
                    })
                    .filter((it): it is Event => !!it)
                setEvents({
                    status: 'loaded',
                    result: generateLocationsMap(events),
                })
            } catch (error) {
                console.error(error)
                setEvents({ status: 'error', error })
            }
        }

        fetchEvents()

        // oxlint-disable-next-line react/exhaustive-deps
    }, [currentOrg, date])

    return events as any
}
