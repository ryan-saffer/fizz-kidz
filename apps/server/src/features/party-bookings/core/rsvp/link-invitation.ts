import { getInvitationShareUrl, type Invitations } from '@fizz-kidz/core'

import { deleteInvitation } from './delete-invitation'
import { moveInvitation } from './move-invitation'

import { env } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export async function linkInvitation(invitation: Invitations.Invitation, distinctId: string) {
    invitation.date = new Date(invitation.date)
    invitation.rsvpDate = new Date(invitation.rsvpDate)

    // store invitationId against booking
    const booking = await DatabaseClient.getPartyBooking(invitation.bookingId)

    // if booking already has an invitation, check who the owner is
    if (booking.invitationId) {
        const existingInvitation = await DatabaseClient.getInvitation(booking.invitationId)

        // check if the user owns the existing invitation
        if (invitation.uid === existingInvitation.uid) {
            // since they own it, it is safe to link this invitation.
            // however we need to replace the existing invitation with this new invitation,
            // because the invitation may have already been shared and therefore the new invitation must have the same id as the old invitation.

            // first delete the existing invitation
            await deleteInvitation(booking.invitationId)

            // then move the new invitation to the old ones location
            await moveInvitation(booking.invitationId, invitation)

            const mixpanel = await MixpanelClient.getInstance()
            await mixpanel.track('invitation-edited', {
                distinct_id: distinctId,
                bookingId: invitation.bookingId,
                invitationId: booking.invitationId,
                partyDate: invitation.date,
                invitation: invitation.invitation,
                parentName: invitation.parentName,
                parentEmail: booking.parentEmail,
            })

            return { invitationId: booking.invitationId }
        } else {
            throw new Error(
                'This booking already has an invitation that is owned by another user. Please log in to the owners account to edit the invitation, or contact Fizz Kidz for help.'
            )
        }
    } else {
        // move the file in storage from temp to its final location
        await moveInvitation(invitation.id, invitation)

        // update the booking to reference the new invitation
        await DatabaseClient.updatePartyBooking(invitation.bookingId, {
            invitationId: invitation.id,
            invitationOwnerUid: invitation.uid,
        })

        // if its the first time the invitation was linked to a booking, send an email to the host confirming
        const mailClient = await MailClient.getInstance()
        await mailClient.sendEmail(
            'invitationCreated',
            booking.parentEmail,
            {
                parentName: invitation.parentName,
                invitationLink: getInvitationShareUrl(env, isUsingEmulator(), invitation.id),
            },
            { bccBookings: false }
        )

        // tracking - only track in the case its the first time its being linked to a booking
        const mixpanel = await MixpanelClient.getInstance()
        await mixpanel.track('invitation-generated', {
            distinct_id: distinctId,
            invitationId: invitation.id,
            partyDate: invitation.date,
            invitation: invitation.invitation,
            bookingId: invitation.bookingId,
            parentName: invitation.parentName,
            parentEmail: booking.parentEmail,
        })

        return { invitationId: invitation.id }
    }
}
