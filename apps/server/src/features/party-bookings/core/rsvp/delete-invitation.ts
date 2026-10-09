import { projectId } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { StorageClient } from '@/integrations/firebase/storage.client'

export async function deleteInvitation(invitationId: string) {
    // delete from storage
    const storage = await StorageClient.getInstance()
    const bucket = storage.bucket(`${projectId}.appspot.com`)
    await bucket.deleteFiles({ prefix: `invitations-v2/${invitationId}` })

    // delete from firestore
    await DatabaseClient.deleteInvitation(invitationId)
}
