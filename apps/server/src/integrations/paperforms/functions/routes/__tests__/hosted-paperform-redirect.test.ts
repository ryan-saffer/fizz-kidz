import express from 'express'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { hostedPaperformRedirect } from '../hosted-paperform-redirect'

import type { Server } from 'http'
import type { AddressInfo } from 'net'

import { DocumentNotFoundError } from '@/integrations/firebase/document-not-found-error'

// a plain stub: errors thrown by a vi.fn fail the test even when the route handles them
const booking = vi.hoisted(() => ({ get: async (): Promise<{ location: string }> => ({ location: 'malvern' }) }))
vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/shared/runtime/is-using-emulator', () => ({ isUsingEmulator: () => false }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: { getPartyBooking: () => booking.get() },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))

let server: Server
let origin = ''
beforeAll(async () => {
    server = express().use('/forms', hostedPaperformRedirect).listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    origin = `http://localhost:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

const redirectFor = async (path: string) =>
    (await fetch(`${origin}${path}`, { redirect: 'manual' })).headers.get('location')

describe('party and cake form links', () => {
    it('opens the custom party form for pilot studio bookings', async () => {
        booking.get = async () => ({ location: 'malvern' })
        expect(await redirectFor('/forms/party?id=booking')).toBe(
            'https://bookings.fizzkidz.com.au/party-form-v2?id=booking'
        )
        expect(await redirectFor('/forms/cake?id=booking')).toBe(
            'https://bookings.fizzkidz.com.au/party-form-v2?id=booking&mode=cake'
        )
    })
    it('keeps every other studio on the Paperform', async () => {
        booking.get = async () => ({ location: 'balwyn' })
        expect(await redirectFor('/forms/party?id=booking')).toBe(
            'https://bookings.fizzkidz.com.au/form?form=party&id=booking'
        )
    })
    it('sends a missing booking to the not found page', async () => {
        booking.get = async () => {
            throw new DocumentNotFoundError('bookings/missing', 'missing')
        }
        expect(await redirectFor('/forms/party?id=missing')).toBe('https://www.fizzkidz.com.au/404')
    })
})
