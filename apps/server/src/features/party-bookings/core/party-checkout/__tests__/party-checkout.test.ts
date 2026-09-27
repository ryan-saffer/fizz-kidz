import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { getPartyPriceList, type PreparePartyCheckout } from '@fizz-kidz/core'

import { getPartyCheckoutStatus, startPartyCheckout } from '../charge-party-checkout'
import { getPartyCheckout } from '../get-party-checkout'
import { preparePartyCheckout } from '../prepare-party-checkout'

const mocks = vi.hoisted(() => ({
    booking: {} as Record<string, unknown>,
    recordPartyPayment: vi.fn(),
    catalogItem: vi.fn(),
    additions: vi.fn(),
    prepareCheckout: vi.fn(),
    startTerminalPayment: vi.fn(),
    getTerminalPayment: vi.fn(),
    order: vi.fn(),
    sendReceipt: vi.fn(),
    syncToZoho: vi.fn(),
    logError: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: { getPartyBooking: async () => mocks.booking, recordPartyPayment: mocks.recordPartyPayment },
}))
vi.mock('@/integrations/square/core/get-catalog-item-options', () => ({
    getCatalogItemOptions: mocks.catalogItem,
    isSoldAtLocation: (option: { locationIds: string[] | null }, locationId: string) =>
        option.locationIds === null || option.locationIds.includes(locationId),
}))
vi.mock('../../party-form-v2/options/get-party-form-v2-additions', () => ({ getPartyFormV2Additions: mocks.additions }))
vi.mock('@/features/payments/core/prepare-checkout', () => ({ prepareCheckout: mocks.prepareCheckout }))
vi.mock('@/features/payments/core/terminal-payment', () => ({
    startTerminalPayment: mocks.startTerminalPayment,
    getTerminalPayment: mocks.getTerminalPayment,
    cancelTerminalPayment: vi.fn(),
}))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => ({ orders: { get: mocks.order } }) },
}))
vi.mock('../send-party-payment-receipt', () => ({ sendPartyPaymentReceipt: mocks.sendReceipt }))
vi.mock('../sync-party-payment-to-zoho', () => ({ syncPartyPaymentToZoho: mocks.syncToZoho }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const prices = getPartyPriceList('dev', false)
const variation = (id: string, name: string, priceCents: number, locationIds: string[] | null = null) => ({
    id,
    name,
    priceCents,
    imageUrl: null,
    locationOverrides: [],
    locationIds,
    absentAtLocationIds: [],
})
const input: PreparePartyCheckout = {
    bookingId: 'booking',
    partyLength: '2',
    includesFood: false,
    childrenCount: 9,
    additions: ['fairyBread'],
    discountCents: 0,
    discountReason: '',
    giftCardNumber: '',
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.booking = {
        parentFirstName: 'Jane',
        parentLastName: 'Smith',
        parentEmail: 'jane@example.com',
        childName: 'Mia',
        childAge: '7',
        location: 'balwyn',
        type: 'studio',
        partyLength: '2',
        includesFood: true,
        oldPrices: false,
        numberOfChildren: '16 - 20',
        fairyBread: true,
        wedges: true,
    }
    mocks.catalogItem.mockResolvedValue({
        variations: [
            variation(prices.variations['1.5'].food, '1.5 Hour Party', 4700),
            variation(prices.variations['1.5'].noFood, '[NO FOOD] 1.5 Hour Party', 4000),
            variation(prices.variations['2'].food, '2 Hour Party', 6000),
            variation(prices.variations['2'].noFood, '[NO FOOD] 2 Hour Party', 5300),
        ],
    })
    mocks.additions.mockResolvedValue([
        {
            key: 'fairyBread',
            variationId: 'fairy-bread',
            name: 'Fairy Bread',
            description: null,
            imageUrl: 'img',
            priceCents: 3000,
        },
        {
            key: 'chickenNuggets',
            variationId: 'nuggets',
            name: 'Chicken Nuggets',
            description: null,
            imageUrl: null,
            priceCents: 3500,
        },
    ])
    mocks.prepareCheckout.mockResolvedValue({ checkoutId: 'order' })
    mocks.recordPartyPayment.mockResolvedValue({ recorded: true, replacedOrderId: null })
})

describe('the checkout config', () => {
    it("offers Square's party prices and the studio's additions, prefilled from the booking", async () => {
        const config = await getPartyCheckout('booking')
        expect(config).toMatchObject({
            blocked: null,
            minChildren: 12,
            partyPrices: [
                { partyLength: '1.5', includesFood: true, name: '1.5 Hour Party', priceCents: 4700 },
                { partyLength: '1.5', includesFood: false, name: '1.5 Hour Party', priceCents: 4000 },
                { partyLength: '2', includesFood: true, name: '2 Hour Party', priceCents: 6000 },
                { partyLength: '2', includesFood: false, name: '2 Hour Party', priceCents: 5300 },
            ],
            // only additions the checkout can charge are prefilled
            prefill: { partyLength: '2', includesFood: true, childrenCount: 16, additions: ['fairyBread'] },
        })
    })

    it('starts at the minimum when the number of children is unknown or below it', async () => {
        mocks.booking.numberOfChildren = ''
        expect(await getPartyCheckout('booking')).toMatchObject({ prefill: { childrenCount: 12 } })
        mocks.booking.numberOfChildren = '9'
        expect(await getPartyCheckout('booking')).toMatchObject({ prefill: { childrenCount: 12 } })
    })

    it("explains why a party can't be charged", async () => {
        mocks.booking.type = 'mobile'
        expect(await getPartyCheckout('booking')).toMatchObject({ blocked: expect.stringContaining('studio parties') })

        mocks.booking.type = 'studio'
        mocks.booking.payment = { totalCents: 1000 }
        expect(await getPartyCheckout('booking')).toMatchObject({ blocked: 'This party has already been paid.' })

        delete mocks.booking.payment
        mocks.booking.oldPrices = true
        const old = getPartyPriceList('dev', true)
        mocks.catalogItem.mockResolvedValue({
            variations: [variation(old.variations['1.5'].food, '[OLD PRICE] 1.5 Hour Party', 3800, ['elsewhere'])],
        })
        expect(await getPartyCheckout('booking')).toMatchObject({ blocked: expect.stringContaining('old prices') })
    })
})

describe('preparing a charge', () => {
    it('charges the party price for at least the minimum children, plus one of each addition', async () => {
        await preparePartyCheckout({ ...input, discountCents: 1500, discountReason: 'Slime ran short' })
        expect(mocks.prepareCheckout).toHaveBeenCalledWith(
            expect.objectContaining({
                program: 'party-checkout',
                customer: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
                lineItems: [
                    { catalogObjectId: prices.variations['2'].noFood, quantity: '12' },
                    { catalogObjectId: 'fairy-bread', quantity: '1' },
                ],
                orderDiscount: { name: 'Discount', cents: 1500 },
                metadata: { bookingId: 'booking', chargedChildren: '12', discountReason: 'Slime ran short' },
                giftCardNumber: '',
            })
        )
    })

    it("uses the old price list for an old-price booking, and doesn't discount by default", async () => {
        mocks.booking.oldPrices = true
        await preparePartyCheckout({ ...input, childrenCount: 20, additions: [], includesFood: true })
        const { lineItems, orderDiscount } = mocks.prepareCheckout.mock.calls[0][0]
        expect(lineItems).toEqual([
            { catalogObjectId: getPartyPriceList('dev', true).variations['2'].food, quantity: '20' },
        ])
        expect(orderDiscount).toBeUndefined()
    })

    it("refuses a paid booking and additions the studio doesn't offer", async () => {
        await expect(preparePartyCheckout({ ...input, additions: ['wedges'] })).rejects.toThrow('no longer offered')
        mocks.booking.payment = { totalCents: 1000 }
        await expect(preparePartyCheckout(input)).rejects.toThrow('already been paid')
        expect(mocks.prepareCheckout).not.toHaveBeenCalled()
    })
})

describe('charging a party', () => {
    const charge = { bookingId: 'booking', checkoutId: 'order', terminalCheckoutId: 'terminal' }

    beforeEach(() => {
        mocks.getTerminalPayment.mockResolvedValue({ status: 'paid', receiptUrl: 'https://receipt' })
        mocks.order.mockResolvedValue({
            order: {
                id: 'order',
                totalMoney: { amount: 60000n },
                discounts: [{ uid: 'order-discount', appliedMoney: { amount: 1500n } }],
                metadata: {
                    program: 'party-checkout',
                    customerEmail: 'jane@example.com',
                    giftCardId: 'gift',
                    giftCardCents: '5000',
                    chargedChildren: '14',
                    discountReason: 'Slime ran short',
                },
            },
        })
    })

    it('ties the terminal charge to the booking', async () => {
        mocks.startTerminalPayment.mockResolvedValue({ status: 'waiting', terminalCheckoutId: 'terminal' })
        expect(await startPartyCheckout({ bookingId: 'booking', checkoutId: 'order', deviceId: 'device' })).toEqual({
            status: 'waiting',
            terminalCheckoutId: 'terminal',
        })
        expect(mocks.startTerminalPayment).toHaveBeenCalledWith({
            checkoutId: 'order',
            deviceId: 'device',
            note: "Mia's 7th party",
            metadata: { bookingId: 'booking' },
        })
    })

    it('records the payment on the booking once, emails the receipt and adds it to Zoho', async () => {
        expect(await getPartyCheckoutStatus(charge)).toEqual({ status: 'paid', receiptUrl: 'https://receipt' })
        expect(mocks.recordPartyPayment).toHaveBeenCalledWith('booking', {
            squareOrderId: 'order',
            totalCents: 60000,
            giftCardCents: 5000,
            discountCents: 1500,
            discountReason: 'Slime ran short',
            chargedChildren: 14,
            receiptUrl: 'https://receipt',
            paidAt: expect.any(String),
        })
        expect(mocks.sendReceipt).toHaveBeenCalledTimes(1)
        expect(mocks.syncToZoho).toHaveBeenCalledTimes(1)

        mocks.booking.payment = mocks.recordPartyPayment.mock.calls[0][1]
        await getPartyCheckoutStatus(charge)
        expect(mocks.recordPartyPayment).toHaveBeenCalledTimes(1)
        expect(mocks.sendReceipt).toHaveBeenCalledTimes(1)
        expect(mocks.syncToZoho).toHaveBeenCalledTimes(1)
    })

    it('logs a party paid twice, keeping the latest payment', async () => {
        mocks.recordPartyPayment.mockResolvedValue({ recorded: true, replacedOrderId: 'earlier-order' })
        await getPartyCheckoutStatus(charge)
        expect(mocks.logError).toHaveBeenCalledWith('Party paid twice', undefined, {
            bookingId: 'booking',
            recordedOrderId: 'earlier-order',
            newOrderId: 'order',
        })
        expect(mocks.sendReceipt).toHaveBeenCalledTimes(1)
    })

    it("doesn't email again when the webhook recorded the payment first", async () => {
        mocks.recordPartyPayment.mockResolvedValue({ recorded: false })
        expect(await getPartyCheckoutStatus(charge)).toMatchObject({ status: 'paid' })
        expect(mocks.sendReceipt).not.toHaveBeenCalled()
        expect(mocks.syncToZoho).not.toHaveBeenCalled()
    })

    it('still reports the payment when the receipt email or Zoho fails', async () => {
        mocks.sendReceipt.mockRejectedValue(new Error('SendGrid down'))
        mocks.syncToZoho.mockRejectedValue(new Error('Zoho down'))
        expect(await getPartyCheckoutStatus(charge)).toMatchObject({ status: 'paid' })
        expect(mocks.logError).toHaveBeenCalledTimes(2)
        expect(mocks.syncToZoho).toHaveBeenCalledTimes(1)
    })

    it("records nothing for a charge that didn't go through", async () => {
        mocks.getTerminalPayment.mockResolvedValue({ status: 'canceled', reason: 'The charge was cancelled.' })
        expect(await getPartyCheckoutStatus(charge)).toEqual({
            status: 'canceled',
            reason: 'The charge was cancelled.',
        })
        expect(mocks.recordPartyPayment).not.toHaveBeenCalled()
    })
})
