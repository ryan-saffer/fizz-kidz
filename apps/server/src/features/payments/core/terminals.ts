import { randomUUID } from 'crypto'

import { capitalise, getSquareLocationId, type Studio } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { SquareClient } from '@/integrations/square/square.client'

export type Terminal = { deviceId: string; name: string }

export type TerminalPairing =
    | { status: 'UNPAIRED'; deviceCodeId: string; code: string; pairBy: string | null }
    | { status: 'PAIRED'; terminal: Terminal }
    | { status: 'EXPIRED' }

/**
 * Square's sandbox can't pair real terminals. It has fixed test devices instead, each acting out one result.
 * Successful sandbox payments must be at most US$25, so sandbox party and product prices are in cents.
 * https://developer.squareup.com/docs/devtools/sandbox/testing
 */
const SANDBOX_TERMINALS: Terminal[] = [
    { deviceId: '9fa747a2-25ff-48ee-b078-04381f7c828f', name: 'Sandbox: card payment succeeds' },
    { deviceId: '841100b9-ee60-4537-9bcf-e30b2ba5e215', name: 'Sandbox: customer cancels' },
    { deviceId: '0a956d49-619a-4530-8e5e-8eac603ffc5e', name: 'Sandbox: times out' },
    { deviceId: 'da40d603-c2ea-4a65-8cfd-f42e36dab0c7', name: 'Sandbox: terminal offline' },
]

/** The Square Terminals paired with the portal at a location. */
export async function listTerminals(locationId: string): Promise<Terminal[]> {
    if (env === 'dev') return SANDBOX_TERMINALS
    const square = await SquareClient.getInstance()
    const terminals: Terminal[] = []
    const codes = await square.devices.codes.list({ locationId, productType: 'TERMINAL_API', status: 'PAIRED' })
    for await (const code of codes) {
        // pairing the same terminal again leaves its earlier code paired too
        if (code.deviceId && !terminals.some((terminal) => terminal.deviceId === code.deviceId))
            terminals.push({ deviceId: code.deviceId, name: code.name || 'Square Terminal' })
    }
    return terminals
}

/**
 * Starts pairing a terminal with the portal: staff sign in on the terminal with the returned code within five
 * minutes. `getTerminalPairing` says when it's paired.
 */
export async function pairTerminal(locationId: string, name: string): Promise<TerminalPairing> {
    if (env === 'dev')
        throwTrpcError('BAD_REQUEST', "Square's sandbox can't pair real terminals. Use a sandbox device.")
    const square = await SquareClient.getInstance()
    const { deviceCode } = await square.devices.codes.create({
        idempotencyKey: randomUUID(),
        deviceCode: { productType: 'TERMINAL_API', locationId, name: name.slice(0, 128) },
    })
    if (!deviceCode?.id || !deviceCode.code) throw new Error('Square returned no device code')
    return { status: 'UNPAIRED', deviceCodeId: deviceCode.id, code: deviceCode.code, pairBy: deviceCode.pairBy ?? null }
}

export async function getTerminalPairing(deviceCodeId: string): Promise<TerminalPairing> {
    const square = await SquareClient.getInstance()
    const { deviceCode } = await square.devices.codes.get({ id: deviceCodeId })
    if (deviceCode?.status === 'PAIRED' && deviceCode.deviceId)
        return {
            status: 'PAIRED',
            terminal: { deviceId: deviceCode.deviceId, name: deviceCode.name || 'Square Terminal' },
        }
    if (deviceCode?.status === 'UNPAIRED' && deviceCode.code)
        return { status: 'UNPAIRED', deviceCodeId, code: deviceCode.code, pairBy: deviceCode.pairBy ?? null }
    return { status: 'EXPIRED' }
}

/** The terminals paired with the portal at a studio (Square's test devices in dev). */
export function listStudioTerminals(studio: Studio) {
    return listTerminals(getSquareLocationId(env === 'prod' ? studio : 'test'))
}

/** Starts pairing the studio's terminal, named after the studio (e.g. 'Cheltenham Terminal'). */
export function pairStudioTerminal(studio: Studio) {
    return pairTerminal(getSquareLocationId(env === 'prod' ? studio : 'test'), `${capitalise(studio)} Terminal`)
}
