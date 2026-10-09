import { randomUUID } from 'crypto'

import { projectId } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { StorageClient } from '@/integrations/firebase/storage.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export async function getInvitationDownloadUrl({
    invitationId,
    distinctId,
}: {
    invitationId: string
    distinctId: string
}) {
    const invitation = await DatabaseClient.getInvitation(invitationId)

    const booking = await DatabaseClient.getPartyBooking(invitation.bookingId)
    const storage = await StorageClient.getInstance()
    const bucketName = `${projectId}.appspot.com`
    const filePath = `invitations-v2/${invitation.id}/invitation.png`
    const file = storage.bucket(bucketName).file(filePath)

    let url: string
    if (isUsingEmulator()) {
        const downloadToken = randomUUID()
        await file.setMetadata({
            metadata: {
                firebaseStorageDownloadTokens: downloadToken,
            },
        })
        url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`
    } else {
        ;[url] = await file.getSignedUrl({
            version: 'v2',
            action: 'read',
            expires: new Date(Date.now() + 1000 * 60 * 5),
            responseDisposition: `attachment; filename="${invitation.childName}'s Party Invitation.png"`,
            responseType: 'image/png',
        })
    }

    const mixpanel = await MixpanelClient.getInstance()
    await mixpanel.track('invitation-download-requested', {
        distinct_id: distinctId,
        bookingId: invitation.bookingId,
        invitationId: invitation.id,
        partyDate: invitation.date,
        invitation: invitation.invitation,
        parentName: invitation.parentName,
        parentEmail: booking.parentEmail,
    })

    return url
}
