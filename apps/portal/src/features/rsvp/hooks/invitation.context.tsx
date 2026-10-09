import { createContext } from 'react'

import type { Invitations } from '@fizz-kidz/core'

export const InvitationContext = createContext<Invitations.Invitation | null>(null)
