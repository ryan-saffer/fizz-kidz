import { isTerminalCheckoutAvailable, type Studio } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'

/** Whether a staff member can charge on a studio's terminal: at the studios trialling it, and anywhere for super-admins. */
export async function canUseTerminalCheckout(studio: Studio, uid: string) {
    if (isTerminalCheckoutAvailable(studio, env)) return true
    const user = await DatabaseClient.getUser(uid)
    return user?.accountType === 'staff' && Object.values(user.roles ?? {}).includes('super-admin')
}
