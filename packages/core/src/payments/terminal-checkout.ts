import { STUDIOS, type Studio, type StudioOrMaster } from '../core/studio'

/**
 * Charging on a studio's Square Terminal from the portal: party checkout and product sales. Both are rolled out to a
 * studio together, once the Square Point of Sale app comes off its iPad.
 */

/**
 * The studios trialling terminal checkout; the rest don't see it. Super-admins have it at every studio, and so does
 * every studio in dev, for Square's sandbox.
 */
export const TERMINAL_CHECKOUT_TRIAL_STUDIOS: Studio[] = ['geelong']

export function isTerminalCheckoutAvailable(studio: Studio, env: 'prod' | 'dev', superAdmin = false) {
    return superAdmin || env === 'dev' || TERMINAL_CHECKOUT_TRIAL_STUDIOS.includes(studio)
}

/** The studios a portal user can charge at: a studio's own, or any for head office, if they have terminal checkout. */
export function getTerminalCheckoutStudios(
    org: StudioOrMaster | null,
    env: 'prod' | 'dev',
    superAdmin = false
): Studio[] {
    const studios = org === 'master' ? STUDIOS : org ? [org] : []
    return studios.filter((studio) => isTerminalCheckoutAvailable(studio, env, superAdmin))
}

/**
 * Where a charge on the terminal is up to. `waiting`: on the terminal. `paid`: done. `canceled`: nothing was charged
 * (staff or the customer cancelled, or the terminal timed out), so it can be sent again.
 */
export type TerminalCheckoutStatus =
    | { status: 'waiting'; terminalCheckoutId: string }
    | { status: 'paid'; receiptUrl: string | null }
    | { status: 'canceled'; reason: string }
