import { collection, deleteDoc, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import type { Invitations, Rsvp, Service } from '@fizz-kidz/core'

import useFirebase from '@integrations/firebase/use-firebase'
import { useConfirm } from '@shared/components/dialogs/confirmation/use-confirmation-dialog'

import type { UseRsvpTableProps } from './use-rsvp-table'

export function useRsvps(invitation: Invitations.Invitation) {
    const firebase = useFirebase()

    const confirm = useConfirm()

    const [rsvps, setRsvps] = useState<
        Service<
            UseRsvpTableProps & {
                attendingCount: number
                notAttendingCount: number
            }
        >
    >({ status: 'loading' })

    const updateRsvp: UseRsvpTableProps['updateRsvp'] = async (id, childIdx, rsvp) => {
        // since children are an array, need to read the whole doc, update the child at the index, then update entire doc
        const rsvpRef = doc(firebase.db, `bookings/${invitation.bookingId}/rsvps/${id}`)
        const existingRsvp = (await getDoc(rsvpRef)).data() as Rsvp
        const existingChild = existingRsvp.children[childIdx]
        const updatedChild = { ...existingChild, rsvp }
        existingRsvp.children[childIdx] = updatedChild
        return updateDoc(rsvpRef, existingRsvp)
    }

    const deleteRsvp: UseRsvpTableProps['deleteRsvp'] = async (id, childIdx) => {
        // get existing
        const rsvpRef = doc(firebase.db, `bookings/${invitation.bookingId}/rsvps/${id}`)
        const existingRsvp = (await getDoc(rsvpRef)).data() as Rsvp
        const result = await confirm({
            title: 'Delete RSVP',
            description: 'Are you sure you want to delete this RSVP? This cannot be undone.',
        })
        if (!result) return
        if (existingRsvp.children.length === 1) {
            // delete the entire RSVP
            await deleteDoc(rsvpRef)
        } else {
            // remove just this child from the array
            existingRsvp.children.splice(childIdx, 1)
            await updateDoc(rsvpRef, existingRsvp)
        }
    }

    useEffect(() => {
        const rsvpsRef = collection(firebase.db, `bookings/${invitation.bookingId}/rsvps`)
        const unsub = onSnapshot(rsvpsRef, (snap) => {
            const rsvps = snap.docs.map((doc) => doc.data() as Rsvp)
            const attendingCount = rsvps.reduce(
                (acc, curr) => acc + curr.children.filter((it) => it.rsvp === 'attending').length,
                0
            )
            const notAttendingCount = rsvps.reduce(
                (acc, curr) => acc + curr.children.filter((it) => it.rsvp === 'not-attending').length,
                0
            )
            setRsvps({
                status: 'loaded',
                result: {
                    rsvps,
                    attendingCount,
                    notAttendingCount,
                    updateRsvp,
                    deleteRsvp,
                },
            })
        })

        return () => unsub()
        // oxlint-disable-next-line react/exhaustive-deps
    }, [invitation.bookingId])

    return rsvps
}
