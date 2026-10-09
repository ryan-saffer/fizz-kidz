import type { Invitations } from '@fizz-kidz/core'

import { projectId } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { StorageClient } from '@/integrations/firebase/storage.client'

/**
 * Gives an invitation a new id, and moves it both in storage and firestore
 *
 * This function assumes that the destination is empty (ie the existing invitation has already been deleted)
 */
export async function moveInvitation(newId: string, _invitation: Invitations.Invitation) {
    const { id: existingId, ...invitation } = _invitation

    // move it in storage
    const storage = await StorageClient.getInstance()
    await storage
        .bucket(`${projectId}.appspot.com`)
        .file(`invitations-v2/temp/${existingId}/invitation.png`)
        .move(`invitations-v2/${newId}/invitation.png`)

    // move it in firestore (to move a firestore document you must create a new one..)
    await DatabaseClient.createInvitation({ ...invitation, id: newId })
}
