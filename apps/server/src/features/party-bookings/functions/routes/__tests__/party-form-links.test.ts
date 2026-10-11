import express from 'express'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { partyFormLinks } from '../party-form-links'

import type { Server } from 'http'
import type { AddressInfo } from 'net'

import { hostedPaperformRedirect } from '@/integrations/paperforms/functions/routes/hosted-paperform-redirect'

vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/shared/runtime/is-using-emulator', () => ({ isUsingEmulator: () => false }))

let server: Server
let origin = ''
beforeAll(async () => {
    // mounted as in app.ts
    server = express().use('/forms', partyFormLinks).use('/forms', hostedPaperformRedirect).listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    origin = `http://localhost:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

const redirectFor = async (path: string) =>
    (await fetch(`${origin}${path}`, { redirect: 'manual' })).headers.get('location')

describe('form links', () => {
    it('opens the party form, and the cake form mode for cake links', async () => {
        expect(await redirectFor('/forms/party?id=booking')).toBe(
            'https://bookings.fizzkidz.com.au/party-form?id=booking'
        )
        expect(await redirectFor('/forms/cake?id=booking')).toBe(
            'https://bookings.fizzkidz.com.au/party-form?id=booking&mode=cake'
        )
    })
    it('sends a link without a booking to the not found page', async () => {
        expect(await redirectFor('/forms/party')).toBe('https://www.fizzkidz.com.au/404')
    })
    it('leaves the other forms to the Paperform route', async () => {
        expect(await redirectFor('/forms/onboarding?name=Sam')).toBe(
            'https://bookings.fizzkidz.com.au/form?form=onboarding&name=Sam'
        )
    })
})
