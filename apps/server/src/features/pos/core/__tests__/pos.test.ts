import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PreparePos } from '@fizz-kidz/core'

import { getPosStatus, startPos } from '../charge-pos'
import { getPos } from '../get-pos'
import { preparePos } from '../prepare-pos'

const mocks = vi.hoisted(() => ({
    env: 'dev' as 'prod' | 'dev',
    items: vi.fn(),
    user: vi.fn(),
    prepareCheckout: vi.fn(),
    startTerminalPayment: vi.fn(),
    getTerminalPayment: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({
    get env() {
        return mocks.env
    },
}))
vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: { getUser: mocks.user } }))
vi.mock('@/integrations/square/core/list-catalog-category-items', () => ({ listCatalogCategoryItems: mocks.items }))
vi.mock('@/features/payments/core/prepare-checkout', () => ({ prepareCheckout: mocks.prepareCheckout }))
vi.mock('@/features/payments/core/terminal-payment', () => ({
    startTerminalPayment: mocks.startTerminalPayment,
    getTerminalPayment: mocks.getTerminalPayment,
    cancelTerminalPayment: vi.fn(),
}))

const item = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
    id,
    variationId: `${id}-variation`,
    name,
    description: null,
    imageUrl: 'img',
    priceCents: 1995,
    locationIds: null,
    absentAtLocationIds: [],
    channels: [],
    ...overrides,
})
const input: PreparePos = {
    studio: 'balwyn',
    items: [
        { variationId: 'slime-variation', quantity: 2 },
        { variationId: 'soap-variation', quantity: 1 },
    ],
    discountCents: 0,
    discountReason: '',
    giftCardNumber: '',
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.env = 'dev'
    mocks.user.mockResolvedValue({ accountType: 'staff', roles: { balwyn: 'studio-ipad' } })
    mocks.items.mockResolvedValue([
        item('slime', 'String Slime Kit'),
        item('soap', 'Soap Making Kit'),
        item('custom', 'Custom Kit', { priceCents: null }),
        item('elsewhere', 'Bath Bomb Kit', { absentAtLocationIds: ['L834ATV1QTRQW'] }),
    ])
    mocks.prepareCheckout.mockResolvedValue({ checkoutId: 'order' })
})

describe('the products on sale', () => {
    it("offers the studio's priced Square products, in Square's order", async () => {
        const sale = await getPos('balwyn', 'staff')
        expect(sale.blocked).toBeNull()
        expect(sale.products?.map((product) => product.name)).toEqual(['String Slime Kit', 'Soap Making Kit'])
        expect(sale.products?.[0]).toEqual({
            variationId: 'slime-variation',
            name: 'String Slime Kit',
            description: null,
            imageUrl: 'img',
            priceCents: 1995,
        })
    })

    it("is only offered at the trial studios in prod, so it's hidden everywhere until one's added", async () => {
        mocks.env = 'prod'
        expect(await getPos('balwyn', 'staff')).toEqual({ blocked: expect.stringContaining('this studio yet') })
        await expect(preparePos(input, 'staff')).rejects.toThrow('this studio yet')
        await expect(startPos({ studio: 'balwyn', checkoutId: 'order', deviceId: 'device' }, 'staff')).rejects.toThrow(
            'this studio yet'
        )
        expect(mocks.prepareCheckout).not.toHaveBeenCalled()
        expect(mocks.startTerminalPayment).not.toHaveBeenCalled()
    })
})

describe('super-admins', () => {
    it('can sell at every studio, even before it trials terminal checkout', async () => {
        mocks.env = 'prod'
        mocks.user.mockResolvedValue({ accountType: 'staff', roles: { master: 'super-admin' } })
        expect((await getPos('balwyn', 'staff')).blocked).toBeNull()
        await preparePos(input, 'staff')
        expect(mocks.prepareCheckout).toHaveBeenCalled()
    })
})

describe('preparing a sale', () => {
    it('charges the chosen products without a customer, with the discount and its reason', async () => {
        await preparePos(
            {
                ...input,
                discountCents: 500,
                discountReason: 'Damaged box',
                giftCardNumber: '7783',
            },
            'staff'
        )
        expect(mocks.prepareCheckout).toHaveBeenCalledWith({
            program: 'pos',
            sourceName: 'Product Sale',
            locationId: 'L834ATV1QTRQW',
            lineItems: [
                { catalogObjectId: 'slime-variation', quantity: '2' },
                { catalogObjectId: 'soap-variation', quantity: '1' },
            ],
            orderDiscount: { name: 'Discount', cents: 500 },
            metadata: { studio: 'balwyn', discountReason: 'Damaged box' },
            giftCardNumber: '7783',
        })
    })

    it("refuses products the studio doesn't sell", async () => {
        await expect(
            preparePos({ ...input, items: [{ variationId: 'elsewhere-variation', quantity: 1 }] }, 'staff')
        ).rejects.toThrow('no longer sold')
        await expect(
            preparePos({ ...input, items: [{ variationId: 'someone-elses', quantity: 1 }] }, 'staff')
        ).rejects.toThrow('no longer sold')
        expect(mocks.prepareCheckout).not.toHaveBeenCalled()
    })
})

describe('charging a sale', () => {
    it('sends it to the terminal, which offers the customer a receipt', async () => {
        mocks.startTerminalPayment.mockResolvedValue({ status: 'waiting', terminalCheckoutId: 'terminal' })
        expect(await startPos({ studio: 'balwyn', checkoutId: 'order', deviceId: 'device' }, 'staff')).toEqual({
            status: 'waiting',
            terminalCheckoutId: 'terminal',
        })
        expect(mocks.startTerminalPayment).toHaveBeenCalledWith({
            checkoutId: 'order',
            deviceId: 'device',
            note: 'Product sale',
            metadata: { studio: 'balwyn' },
            receiptScreen: true,
        })
    })

    it("checks the charge against the studio's order", async () => {
        mocks.getTerminalPayment.mockResolvedValue({ status: 'paid', receiptUrl: 'https://receipt' })
        expect(await getPosStatus({ studio: 'balwyn', checkoutId: 'order', terminalCheckoutId: 'terminal' })).toEqual({
            status: 'paid',
            receiptUrl: 'https://receipt',
        })
        expect(mocks.getTerminalPayment).toHaveBeenCalledWith({
            checkoutId: 'order',
            terminalCheckoutId: 'terminal',
            metadata: { studio: 'balwyn' },
        })
    })
})
