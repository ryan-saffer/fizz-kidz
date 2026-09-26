import { assertNever } from '../utilities/assert-never'

import type { PartyForm } from '../paperform'

export function mapCakeSizeToSquareVariation(env: 'prod' | 'dev', size: PartyForm['cake_size']) {
    if (env === 'prod') {
        switch (size) {
            case 'small_cake':
                return 'SIEEWOY43I4ZBOUGBIU6QIB6'
            case 'medium_cake':
                return 'YIB2F72Q4LDT4VO4SS72CNVK'
            case 'large_cake':
                return 'UBLZX5LLDVOTW5DEVKZ6GK2T'
            default: {
                assertNever(size)
                throw new Error(`Unable to get cake size variation for size: ${size}`)
            }
        }
    }

    switch (size) {
        case 'small_cake':
            return 'J62FGIPYLCQEWHHAOSQRKBJT'
        case 'medium_cake':
            return '33R4W7BPZG5TXCB3IFRGT3AF'
        case 'large_cake':
            return 'MX53WUFOD5KFKSTJU5LVISM6'
        default: {
            assertNever(size)
            throw new Error(`Unable to get cake size variation for size: ${size}`)
        }
    }
}

export function mapServingMethodToSquareVariation(env: 'prod' | 'dev', serving: PartyForm['cake_served']) {
    if (env === 'prod') {
        switch (serving) {
            case 'cup':
                return '3S36ETMZHIOEUCVIABVDMNRZ'
            case 'waffle_cones':
                return 'BIWBZUERN7DKIB7DTQ5B2DQZ'
            case 'bring_own_bowls':
                return '3DPDWN4UBGKQVKG6KKDMJWZK'
            default: {
                assertNever(serving)
                throw new Error(`Unable to get cake serving variation for serving: ${serving}`)
            }
        }
    }

    switch (serving) {
        case 'cup':
            return 'WTY2PTMZOEECGRQ3O5ZRUFHP'
        case 'waffle_cones':
            return 'P3TRCXX2BQZEFBNWQZSBKLLO'
        case 'bring_own_bowls':
            return 'BJ2NTN2PGFVE3MISLW3N56VY'
        default: {
            assertNever(serving)
            throw new Error(`Unable to get cake serving variation for serving: ${serving}`)
        }
    }
}

export function mapCandleToSquareVariation(env: 'prod' | 'dev', candles: PartyForm['cake_candles']) {
    if (env === 'prod') {
        switch (candles) {
            case 'include_candles':
                return 'LW2224GVK3WVH3GVF3LJBGEQ'
            case 'bring_own_candles':
                return 'TBO2E7MXAOX5RZCQOXBTSLP6'
            default: {
                assertNever(candles)
                throw new Error(`Unable to get cake candles variation for candles: ${candles}`)
            }
        }
    }

    switch (candles) {
        case 'include_candles':
            return 'SDSPAFYRML6Q6O4PL57VURE3'
        case 'bring_own_candles':
            return 'CCX2JDG3KLFWXSDK57LL6IIV'
        default: {
            assertNever(candles)
            throw new Error(`Unable to get cake candles variation for candles: ${candles}`)
        }
    }
}
