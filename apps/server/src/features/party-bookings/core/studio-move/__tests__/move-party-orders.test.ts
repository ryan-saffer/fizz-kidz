import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { mapTakeHomeBagToSquareVariation } from '@fizz-kidz/core'
import type { Booking } from '@fizz-kidz/core'

import { getStudioMoveOrders } from '../get-studio-move-orders'
import { movePartyOrders } from '../move-party-orders'

const mocks = vi.hoisted(() => ({
    sendEmail: vi.fn(),
    orderable: vi.fn(),
    reserve: vi.fn(),
    release: vi.fn(),
    cakeOptions: vi.fn(),
    logError: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/shared/runtime/is-using-emulator', () => ({ isUsingEmulator: () => false }))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))
vi.mock('@/features/inventory/core/inventory.reservations', () => ({
    getOrderableInventory: mocks.orderable,
    reserveInventoryForBooking: mocks.reserve,
    releaseInventoryForBooking: mocks.release,
}))
vi.mock('../../party-form/options/get-party-form-cake-options', () => ({
    getStockedPartyFormCakeOptions: mocks.cakeOptions,
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const option = (name: string, id = name) => ({ id, name, priceCents: 0, imageUrl: null })

/** What Werribee stocks: medium chocolate and vanilla unicorn cakes, served in bowls, with plain candles. */
const werribeeCakeOptions = {
    sizes: [option('Medium')],
    designs: [option('Unicorn', 'SQUARE_UNICORN')],
    flavours: [option('Chocolate'), option('Vanilla')],
    servingOptions: [option('Bowls and spoons')],
    candleOptions: [option('Plain candles')],
    minFlavours: 2,
    maxFlavours: 2,
    fixedFlavours: ['Chocolate', 'Vanilla'],
}

const stockedCake = {
    selection: 'Unicorn',
    size: 'Medium',
    flavours: ['Vanilla', 'Chocolate'],
    served: 'Bowls and spoons',
    candles: 'Plain candles',
}

const lollyBagsId = mapTakeHomeBagToSquareVariation('prod', 'lollyBags')

function party(location: Booking['location'], order: Partial<Booking> = {}): Booking {
    return {
        type: 'studio',
        location,
        dateTime: new Date('2026-11-14T00:00:00.000Z'),
        parentFirstName: 'Jane',
        parentLastName: 'Smith',
        parentEmail: 'jane@example.com',
        parentMobile: '0400000000',
        ...order,
    } as Booking
}

function orderable(entries: [string, string, number][]) {
    return new Map(entries.map(([squareId, itemId, available]) => [squareId, { item: { id: itemId }, available }]))
}

const emailsSent = (email: string) => mocks.sendEmail.mock.calls.filter(([name]) => name === email)

beforeEach(() => {
    vi.clearAllMocks()
    mocks.cakeOptions.mockResolvedValue(werribeeCakeOptions)
    mocks.orderable.mockResolvedValue(
        orderable([
            ['SQUARE_UNICORN', 'unicorn', 3],
            [lollyBagsId, 'lolly-bags', 20],
        ])
    )
})

describe('where a moved party gets its order from', () => {
    it.each([
        ['balwyn', 'malvern', 'supplier-to-supplier'],
        ['geelong', 'malvern', 'stock-to-supplier'],
        ['balwyn', 'werribee', 'supplier-to-stock'],
        ['geelong', 'werribee', 'stock-to-stock'],
    ] as const)('%s to %s is %s', (from, to, expected) => {
        expect(getStudioMoveOrders('studio', from, to)).toBe(expected)
    })

    it('treats mobile parties as supplier orders, wherever they move', () => {
        expect(getStudioMoveOrders('mobile', 'geelong', 'werribee')).toBe('supplier-to-supplier')
    })
})

describe('moving a party order to another studio', () => {
    it('tells the supplier the new delivery studio, between supplier studios', async () => {
        await movePartyOrders({
            bookingId: 'b1',
            booking: party('malvern', { cake: { ...stockedCake, size: 'Large' } }),
            previousStudio: 'balwyn',
        })

        const [[, to, values, options]] = emailsSent('partySupplierOrderChange')
        expect(to).toBe('orders@birthdaycakeshop.com.au')
        expect(values.heading).toBe('Delivery studio changed')
        expect(values.cake.size).toBe('Large')
        expect(options.bcc).toEqual(['malvern@fizzkidz.com.au'])
        expect(mocks.release).not.toHaveBeenCalled()
        expect(mocks.reserve).not.toHaveBeenCalled()
    })

    it("doesn't email the supplier when nothing was ordered", async () => {
        await movePartyOrders({ bookingId: 'b1', booking: party('malvern'), previousStudio: 'balwyn' })
        expect(mocks.sendEmail).not.toHaveBeenCalled()
    })

    it('releases the old stock and sends the supplier a new order, from stock to a supplier studio', async () => {
        await movePartyOrders({
            bookingId: 'b1',
            booking: party('malvern', { cake: stockedCake, takeHomeBags: { lollyBags: 12 } }),
            previousStudio: 'geelong',
        })

        expect(mocks.release).toHaveBeenCalledWith(
            expect.objectContaining({ location: 'geelong', bookingId: 'b1', idempotencyKey: expect.any(String) })
        )
        expect(mocks.release.mock.calls[0][0].idempotencyKey).not.toBe('b1-released')
        const [[, , values]] = emailsSent('partySupplierOrderChange')
        expect(values.heading).toBe('New order: party moved studio')
        expect(values.takeHomeBags).toEqual([{ name: 'Lolly Bags', quantity: '12' }])
    })

    it('cancels the supplier order and reserves stock at the new studio, from a supplier studio to stock', async () => {
        await movePartyOrders({
            bookingId: 'b1',
            booking: party('werribee', { cake: stockedCake, takeHomeBags: { lollyBags: 12 } }),
            previousStudio: 'balwyn',
        })

        const [[, , values, options]] = emailsSent('partySupplierOrderChange')
        expect(values.heading).toBe('Order cancelled')
        expect(options.bcc).toEqual(['balwyn@fizzkidz.com.au'])
        expect(mocks.reserve).toHaveBeenCalledWith(
            expect.objectContaining({
                location: 'werribee',
                bookingId: 'b1',
                lines: [
                    { itemId: 'unicorn', quantity: 1 },
                    { itemId: 'lolly-bags', quantity: 12 },
                ],
            })
        )
        // everything was covered, so the studio isn't bothered
        expect(emailsSent('partyStudioMoveStockAlert')).toHaveLength(0)
    })

    it('moves stock between stocked studios without emailing the supplier', async () => {
        await movePartyOrders({
            bookingId: 'b1',
            booking: party('werribee', { cake: stockedCake }),
            previousStudio: 'geelong',
        })

        expect(mocks.release).toHaveBeenCalledWith(expect.objectContaining({ location: 'geelong' }))
        expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ location: 'werribee' }))
        expect(emailsSent('partySupplierOrderChange')).toHaveLength(0)
    })

    it("doesn't reserve a cake the new studio doesn't stock, and tells the studio and owner every difference", async () => {
        await movePartyOrders({
            bookingId: 'b1',
            booking: party('werribee', {
                cake: { ...stockedCake, selection: 'Dinosaur', size: 'Large', flavours: ['Strawberry'] },
            }),
            previousStudio: 'balwyn',
        })

        expect(mocks.reserve).not.toHaveBeenCalled()
        const [[, to, values, options]] = emailsSent('partyStudioMoveStockAlert')
        expect(to).toBe('werribee@fizzkidz.com.au')
        expect(options.bcc).toEqual(['paris.c@fizzkidz.com.au'])
        expect(values.problems).toHaveLength(1)
        expect(values.problems[0].title).toBe("The Dinosaur cake can't come from Werribee's stock")
        expect(values.problems[0].detail).toContain("Werribee doesn't stock the Dinosaur design.")
        expect(values.problems[0].detail).toContain('this one is Large')
        expect(values.problems[0].detail).toContain('this one is Strawberry')
        expect(values.hasReserved).toBe(false)
    })

    it('reserves everything even when the new studio is short, and says what is short', async () => {
        mocks.orderable.mockResolvedValue(
            orderable([
                ['SQUARE_UNICORN', 'unicorn', 0],
                [lollyBagsId, 'lolly-bags', 10],
            ])
        )

        await movePartyOrders({
            bookingId: 'b1',
            booking: party('werribee', { cake: stockedCake, takeHomeBags: { lollyBags: 15 } }),
            previousStudio: 'geelong',
        })

        expect(mocks.reserve.mock.calls[0][0].lines).toEqual([
            { itemId: 'unicorn', quantity: 1 },
            { itemId: 'lolly-bags', quantity: 15 },
        ])
        const [[, , values]] = emailsSent('partyStudioMoveStockAlert')
        expect(values.problems.map((problem: { title: string }) => problem.title)).toEqual([
            'No Unicorn cakes left',
            'Not enough Lolly Bags',
        ])
        expect(values.problems[1].detail).toContain('only 10 are available')
    })

    it('tells the studio about bags it doesn’t stock at all', async () => {
        mocks.orderable.mockResolvedValue(orderable([]))

        await movePartyOrders({
            bookingId: 'b1',
            booking: party('werribee', { takeHomeBags: { lollyBags: 12 } }),
            previousStudio: 'geelong',
        })

        expect(mocks.reserve).not.toHaveBeenCalled()
        const [[, , values]] = emailsSent('partyStudioMoveStockAlert')
        expect(values.problems[0].title).toBe("Werribee doesn't stock Lolly Bags")
    })

    it('keeps going when a step fails, and logs it', async () => {
        mocks.release.mockRejectedValue(new Error('firestore down'))

        await movePartyOrders({
            bookingId: 'b1',
            booking: party('malvern', { cake: stockedCake }),
            previousStudio: 'geelong',
        })

        expect(mocks.logError).toHaveBeenCalledOnce()
        expect(emailsSent('partySupplierOrderChange')).toHaveLength(1)
    })
})
