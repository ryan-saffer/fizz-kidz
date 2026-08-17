import { getApplicationDomain } from '../utilities/application-domain'

export type Rsvp = {
    id: string
    source: 'guest' | 'host'
    parentName: string
    parentEmail?: string
    parentMobile?: string
    children: Child[]
    message?: string
}

type Child = {
    name: string
    dob?: Date | string
    rsvp: 'attending' | 'not-attending'
    hasAllergies?: boolean
    allergies?: string
}

export type RsvpStatus = Rsvp['children'][number]['rsvp']

/**
 * Public guest-facing invite URL.
 * This must use the stable invitationId because it is what gets shared and embedded in QR codes.
 */
export function getInvitationShareUrl(env: 'dev' | 'prod', useEmulator: boolean, invitationId: string) {
    return `${getApplicationDomain(env, useEmulator)}/invite/${invitationId}`
}

/**
 * Host entry URL.
 * This uses bookingId so the server can decide whether to open an existing invite or start the design flow.
 * It intentionally stays on the webhook route because it is not a public guest-facing URL.
 */
export function getInvitationEntryUrl(env: 'dev' | 'prod', useEmulator: boolean, bookingId: string) {
    return `${getApplicationDomain(env, useEmulator)}/api/webhooks/invitation/${bookingId}`
}
