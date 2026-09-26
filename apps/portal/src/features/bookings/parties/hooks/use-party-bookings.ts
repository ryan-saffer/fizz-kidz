import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { DateTime } from 'luxon'
import { useEffect, useRef, useState } from 'react'

import type { FirestoreBooking, Service, Studio, WithId } from '@fizz-kidz/core'
import { STUDIOS } from '@fizz-kidz/core'

import { useDateNavigation } from '@features/bookings/date-navigation/date-navigation.hooks'
import { useLocationFilter } from '@features/bookings/location-filter/location-filter.hook'
import useFirebase from '@integrations/firebase/use-firebase'
import { useOrg } from '@session/use-org'

export function usePartyBookings() {
    const firebase = useFirebase()

    const urlSearchParams = new URLSearchParams(window.location.search)
    const id = useRef(urlSearchParams.get('id'))

    const { currentOrg } = useOrg()

    const { filterByLocation } = useLocationFilter()

    const [bookings, setBookings] = useState<Service<Record<Studio, WithId<FirestoreBooking>[]>>>({
        status: 'loading',
    })

    const { date, setDate } = useDateNavigation()

    const generateLocationsMap = (bookings: WithId<FirestoreBooking>[]): Record<Studio, WithId<FirestoreBooking>[]> => {
        return STUDIOS.reduce(
            (acc, curr) => ({ ...acc, [curr]: bookings.filter((it) => it.location === curr) }),
            {} as any
        )
    }

    const runSubscription = useRef(true)

    useEffect(() => {
        if (!runSubscription.current) {
            runSubscription.current = true
            return
        }

        setBookings({ status: 'loading' })

        let unsubscribe = () => {}

        if (id.current) {
            const bookingRef = doc(firebase.db, 'bookings', id.current)
            unsubscribe = onSnapshot(bookingRef, (snapshot) => {
                if (!snapshot.exists()) {
                    setBookings({
                        status: 'loaded',
                        result: generateLocationsMap([]),
                    })
                    return
                }
                const booking = snapshot.data() as FirestoreBooking
                setDate(DateTime.fromJSDate(booking.dateTime.toDate()))
                runSubscription.current = false // since we changed the date, this stops an infinite loop
                id.current = null
                setBookings({ status: 'loaded', result: generateLocationsMap([{ ...booking, id: snapshot.id }]) })
                filterByLocation(booking.location)
            })
        } else {
            const followingDate = date.plus({ days: 1 })
            const constraints = [
                where('dateTime', '>', date.toJSDate()),
                where('dateTime', '<', followingDate.toJSDate()),
            ]

            if (currentOrg !== 'master') {
                constraints.push(where('location', '==', currentOrg))
            }

            const bookingsQuery = query(collection(firebase.db, 'bookings'), ...constraints)
            unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
                const bookings = snapshot.docs.map((doc) => ({
                    ...(doc.data() as FirestoreBooking),
                    id: doc.id,
                }))
                const deletedBooking = snapshot.docChanges().find((doc) => doc.type === 'removed')
                setBookings({
                    status: 'loaded',
                    result: generateLocationsMap([
                        ...bookings,
                        ...(deletedBooking
                            ? [{ ...(deletedBooking.doc.data() as FirestoreBooking), id: deletedBooking.doc.id }]
                            : []),
                    ]),
                })
            })
        }

        return () => unsubscribe()
        // oxlint-disable-next-line react/exhaustive-deps
    }, [date, currentOrg])

    return bookings
}
