import { deleteInvitation } from './delete-invitation'

import { projectId } from '@/app/init/firebase'
import { FirestoreRefs } from '@/integrations/firebase/firestore.refs'
import { StorageClient } from '@/integrations/firebase/storage.client'

/**
 * Deletes invitations that are no longer linked to any party booking.
 * Also deletes everything in the temp folder and cleans up storage folders that no longer have a Firestore doc.
 *
 * NOTE: Because the temp folder is deleted, its important this is run when not in use, otherwise invitations currently being worked on may be deleted.
 *
 * Strategy:
 *  - Fetch all bookings and collect invitationIds that are still in use.
 *  - Fetch all invitation documents.
 *  - For each invitation not referenced by a booking, delete the Firestore doc and its storage folder.
 *  - Remove any storage folders under invitations-v2/ that have no corresponding Firestore invitation doc.
 *
 * @returns count of stale invitations removed
 */
export async function cleanUpStaleInvitations() {
    const bookingsRef = await FirestoreRefs.partyBookings()
    const invitationsRef = await FirestoreRefs.invitations()

    // only fetch invitationId from bookings to reduce payload
    const [bookingsSnap, invitationsSnap] = await Promise.all([
        bookingsRef.select('invitationId').get(),
        invitationsRef.get(),
    ])

    const activeInvitationIds = new Set<string>()
    bookingsSnap.forEach((doc) => {
        const invitationId = doc.get('invitationId') as string | undefined
        if (invitationId) {
            activeInvitationIds.add(invitationId)
        }
    })

    const staleInvitations = invitationsSnap.docs.filter((invitationDoc) => !activeInvitationIds.has(invitationDoc.id))

    if (staleInvitations.length > 0) {
        await Promise.all(staleInvitations.map((invitationDoc) => deleteInvitation(invitationDoc.id)))
    }

    // Delete storage-only orphans (no Firestore doc)
    const storageOrphansRemoved = await deleteStorageOrphans(new Set(invitationsSnap.docs.map((doc) => doc.id)))

    // Also clear the temp folder
    const storage = await StorageClient.getInstance()
    const bucket = storage.bucket(`${projectId}.appspot.com`)
    await bucket.deleteFiles({ prefix: 'invitations-v2/temp' })

    return { removed: staleInvitations.length, storageOrphansRemoved }
}

async function deleteStorageOrphans(invitationIdsInFirestore: Set<string>) {
    const storage = await StorageClient.getInstance()
    const bucket = storage.bucket(`${projectId}.appspot.com`)
    const [files] = await bucket.getFiles({ prefix: 'invitations-v2/' })

    const storageIds = new Set<string>()
    files.forEach((file) => {
        const parts = file.name.split('/')
        const maybeId = parts[1]
        if (maybeId && maybeId !== 'temp') {
            storageIds.add(maybeId)
        }
    })

    const orphans = Array.from(storageIds).filter((id) => !invitationIdsInFirestore.has(id))
    if (orphans.length === 0) {
        return 0
    }

    await Promise.all(orphans.map((id) => bucket.deleteFiles({ prefix: `invitations-v2/${id}` })))
    return orphans.length
}
