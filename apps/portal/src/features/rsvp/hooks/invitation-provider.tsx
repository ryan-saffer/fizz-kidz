import type { Invitations } from '@fizz-kidz/core'

import { InvitationContext } from './invitation.context'

import type { ReactNode } from 'react'

export function InvitationProvider({
    invitation,
    children,
}: {
    invitation: Invitations.Invitation
    children: ReactNode
}) {
    return <InvitationContext.Provider value={invitation}>{children}</InvitationContext.Provider>
}
