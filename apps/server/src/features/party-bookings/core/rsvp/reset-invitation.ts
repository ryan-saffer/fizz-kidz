import { projectId } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { StorageClient } from '@/integrations/firebase/storage.client'

/**
 * Deletes the invitation, and completely unlinks it from the booking.
 *
 * This exists only for testing purposes, to enable an easy way to reset bookings.
 */
export async function resetInvitation(invitationId: string) {
    // Delete the invitation from storage and firestore
    const storage = await StorageClient.getInstance()
    await storage.bucket(`${projectId}.appspot.com`).file(`invitations-v2/${invitationId}/invitation.png`).delete()

    await DatabaseClient.deleteInvitation(invitationId)

    // remove the fields from the booking in firestore
    const { id } = await DatabaseClient.getPartyBookingByInvitationId(invitationId)
    await DatabaseClient.updatePartyBooking(id, { invitationId: '', invitationOwnerUid: '' })
}
