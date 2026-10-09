import fsPromise from 'fs/promises'
import os from 'os'
import path from 'path'

import type { Invitations, WithoutId, WithoutUid } from '@fizz-kidz/core'
import { generateRandomString } from '@fizz-kidz/core'

import { InvitationImageGenerator } from './invitation-image-generator'

import { projectId } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { StorageClient } from '@/integrations/firebase/storage.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'

/**
 * Creates and uploads an invitation to storage, but does not create a document in firestore.
 *
 * Many invitations can be created, but a booking can only have one invitation linked to it.
 * Linking an invitation happens after the invitation has been created, and the parent confirms to finalize.
 *
 * @param input
 * @returns
 */
export async function generateInvitation(input: WithoutId<WithoutUid<Invitations.Invitation>>) {
    // serialise back into a date
    input.date = new Date(input.date)
    input.rsvpDate = new Date(input.rsvpDate)

    // check if this booking already has an invitation.
    // if so, use the same id, since the qr code will need to link to the correct invitation.
    const booking = await DatabaseClient.getPartyBooking(input.bookingId)
    const id = booking.invitationId || generateRandomString()

    // invitations are first stored in temp, and only moved to their actual location during linking.
    // this makes it very easy to clear all unlinked invitations.
    const filename = 'invitation.png'
    const FIREBASE_STORAGE_PATH = `invitations-v2/temp/${id}/${filename}`

    let tempDir: string | undefined

    const imageGenerator = new InvitationImageGenerator({ ...input, id })
    try {
        tempDir = await fsPromise.mkdtemp(path.join(os.tmpdir(), 'fizzkidz-invitation-'))
        const LOCAL_PATH = path.join(tempDir, filename)

        await imageGenerator.generatePng(LOCAL_PATH)

        const storage = await StorageClient.getInstance()
        await storage.bucket(`${projectId}.appspot.com`).upload(LOCAL_PATH, {
            destination: FIREBASE_STORAGE_PATH,
        })

        if (!booking.invitationId) {
            const mixpanel = await MixpanelClient.getInstance()
            await mixpanel.track('invitation-preview-generated', {
                distinct_id: booking.parentEmail,
                bookingId: input.bookingId,
                invitationId: id,
                partyDate: input.date,
                invitation: input.invitation,
                parentName: input.parentName,
                parentEmail: booking.parentEmail,
            })
        }
    } finally {
        if (tempDir) {
            await fsPromise.rm(tempDir, { recursive: true, force: true })
        }
    }

    return { invitationId: id }
}
