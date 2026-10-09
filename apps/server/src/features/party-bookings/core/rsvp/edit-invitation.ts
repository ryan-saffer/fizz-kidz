import type { Invitations } from '@fizz-kidz/core'

import { generateInvitation } from './generate-invitation'
import { linkInvitation } from './link-invitation'

/**
 * Used for editing existing invitations. Generates a new one and replaces the existing one.
 */
export async function generateAndLinkInvitation(invitation: Invitations.Invitation, distinctId: string) {
    const { invitationId } = await generateInvitation(invitation)
    await linkInvitation({ ...invitation, id: invitationId }, distinctId)
}
