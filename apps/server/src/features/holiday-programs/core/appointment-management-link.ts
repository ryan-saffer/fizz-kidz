import { createHmac, timingSafeEqual } from 'node:crypto'

import { getApplicationDomain } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

// Signed with the Acuity API key, so rotating that key revokes existing links.
export function createAppointmentManagementToken(appointmentId: number) {
    return createHmac('sha256', process.env.ACUITY_API_KEY!)
        .update(`holiday-program-management:${appointmentId}`)
        .digest('hex')
}

export function verifyAppointmentManagementToken(appointmentId: number, token: string) {
    const expected = Buffer.from(createAppointmentManagementToken(appointmentId))
    const actual = Buffer.from(token)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function getAppointmentManagementUrl(appointmentId: number) {
    const url = new URL(`/programs/manage/${appointmentId}`, getApplicationDomain(env, isUsingEmulator()))
    // keep the token in the fragment so it is never sent to the server or in referrers
    url.hash = `token=${createAppointmentManagementToken(appointmentId)}`
    return url.toString()
}
