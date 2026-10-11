import { getApplicationDomain, type PartyFormMode } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

/**
 * The party form link we send (emails and the portal's copy-link button). It redirects to the form when clicked (see
 * `party-form-links.ts`), so the form can move without breaking links already sent.
 */
export function getPartyFormUrl(bookingId: string, useEmulator = isUsingEmulator()) {
    return buildFormLink('party', bookingId, useEmulator)
}

/** The cake form link: the same form, ordering only a cake and take-home goodies (`mode: 'cake'`). */
export function getCakeFormUrl(bookingId: string, useEmulator = isUsingEmulator()) {
    return buildFormLink('cake', bookingId, useEmulator)
}

/** Where those links lead: the party form in the portal. */
export function getPartyFormPageUrl(mode: PartyFormMode, bookingId: string, useEmulator = isUsingEmulator()) {
    const url = new URL(`${getApplicationDomain(env, useEmulator)}/party-form`)
    url.searchParams.set('id', bookingId)
    if (mode === 'cake') url.searchParams.set('mode', 'cake')
    return url.toString()
}

function buildFormLink(mode: PartyFormMode, bookingId: string, useEmulator: boolean) {
    const url = new URL(`${getApplicationDomain(env, useEmulator)}/forms/${mode}`)
    url.searchParams.set('id', bookingId)
    return url.toString()
}
