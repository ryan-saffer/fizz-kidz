import { getStudioContactEmail } from '@fizz-kidz/core'
import type { Studio } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'

// TODO: confirm owner addresses. Werribee (franchise): Paris. Geelong (corporate): Courtney/AM and the Customer team.
const INVENTORY_OWNER_EMAILS: Partial<Record<Studio, string[]>> = {
    werribee: ['werribee@fizzkidz.com.au'],
    geelong: ['geelong@fizzkidz.com.au', 'bookings@fizzkidz.com.au'],
}

/** Who gets low-stock and stock discrepancy alerts for a studio. Falls back to the studio's contact email. */
export function getInventoryOwnerEmails(location: Studio) {
    if (env !== 'prod') return [getStudioContactEmail(location, 'dev')]

    return INVENTORY_OWNER_EMAILS[location] ?? [getStudioContactEmail(location)]
}
