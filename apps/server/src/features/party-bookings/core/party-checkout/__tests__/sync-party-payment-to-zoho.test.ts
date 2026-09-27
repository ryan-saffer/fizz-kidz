import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Booking, PartyPayment } from '@fizz-kidz/core'

import { syncPartyPaymentToZoho } from '../sync-party-payment-to-zoho'

import type { Square } from 'square'

const mocks = vi.hoisted(() => ({ recordPartyPayment: vi.fn() }))
vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@/integrations/zoho/zoho.client', () => ({
    ZohoClient: class {
        recordPartyPayment = mocks.recordPartyPayment
    },
}))

const order = {
    lineItems: [
        {
            quantity: '14',
            name: 'Studio Party',
            variationName: '2 Hour Party',
            variationTotalPriceMoney: { amount: 84000n },
        },
        {
            quantity: '1',
            name: 'Fairy Bread',
            variationName: 'Regular',
            variationTotalPriceMoney: { amount: 3000n },
        },
    ],
} as Square.Order
const payment: PartyPayment = {
    squareOrderId: 'order',
    totalCents: 85500,
    giftCardCents: 5000,
    discountCents: 1500,
    discountReason: 'Slime ran short',
    chargedChildren: 14,
    receiptUrl: 'https://receipt',
    paidAt: '2026-09-27T05:04:00.000Z',
}

beforeEach(() => vi.clearAllMocks())

describe('adding a party payment to Zoho', () => {
    it("sets the deal's amount and notes the breakdown", async () => {
        await syncPartyPaymentToZoho({ zohoDealId: 'deal' } as Booking, order, payment)
        expect(mocks.recordPartyPayment).toHaveBeenCalledWith({
            dealId: 'deal',
            amountCents: 85500,
            note: expect.any(String),
        })
        expect(mocks.recordPartyPayment.mock.calls[0][0].note).toMatchInlineSnapshot(`
          "Paid $855.00 on the studio's Square Terminal, Sun 27 Sep 2026, 3:04 PM

          14 × Studio Party – 2 Hour Party: $840.00
          1 × Fairy Bread: $30.00
          Discount: -$15.00 (Slime ran short)
          Paid by gift card: $50.00
          Total: $855.00

          Receipt: https://receipt
          Square order: order"
        `)
    })

    it('does nothing for a booking without a Zoho deal', async () => {
        await syncPartyPaymentToZoho({} as Booking, order, payment)
        expect(mocks.recordPartyPayment).not.toHaveBeenCalled()
    })
})
