import { getApplicationDomain } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export type HostedPaperform = 'onboarding' | 'incursion' | 'incident-reporting' | 'staff-feedback'

/**
 * Takes customers to the client side hosted forms url.
 * This should only ever be redirected to from the server - customers should always be sent to {@link buildHostedPaperformUrl}.
 * Providing customers this link directly could lead to breaking changes in the future.
 */
export function buildHostedPaperformClientUrl(
    form: HostedPaperform,
    params: Record<string, string>,
    useEmulator = isUsingEmulator()
) {
    const url = new URL(`${getApplicationDomain(env, useEmulator)}/form`)
    url.searchParams.set('form', form)

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
    })

    return url.toString()
}

/**
 * Takes customers to our server endpoint that will then redirect them where they need to go.
 * Exists to ensure backwards compatability - destination may change, but links sent in emails continue working.
 */
export function buildHostedPaperformUrl(
    form: HostedPaperform,
    params: Record<string, string>,
    useEmulator = isUsingEmulator()
) {
    const url = new URL(`${getApplicationDomain(env, useEmulator)}/forms/${form}`)

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
    })

    return url.toString()
}
