import { capitalise, getSquareLocationId, type Studio } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { listTerminals, pairTerminal } from '@/features/payments/core/terminals'

/** The terminals paired with the portal at a studio (Square's test devices in dev). */
export function listPartyTerminals(studio: Studio) {
    return listTerminals(getSquareLocationId(env === 'prod' ? studio : 'test'))
}

/** Starts pairing the studio's terminal, named after the studio (e.g. 'Cheltenham Terminal'). */
export function pairPartyTerminal(studio: Studio) {
    return pairTerminal(getSquareLocationId(env === 'prod' ? studio : 'test'), `${capitalise(studio)} Terminal`)
}
