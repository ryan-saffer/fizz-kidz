import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { cancelTerminalPayment, getTerminalPayment, startTerminalPayment } from '../terminal-payment'

const square = vi.hoisted(() => ({
    orders: { get: vi.fn(), pay: vi.fn() },
    payments: { create: vi.fn(), cancel: vi.fn(), get: vi.fn() },
    terminal: { checkouts: { create: vi.fn(), get: vi.fn(), cancel: vi.fn() } },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => square },
    getSquareError: async (error: { statusCode?: number }) => (error.statusCode ? error : undefined),
}))

const metadata = { bookingId: 'booking' }
const order = (giftCardCents = 0, state = 'OPEN') => ({
    id: 'order',
    locationId: 'location',
    customerId: 'customer',
    state,
    totalMoney: { currency: 'AUD', amount: 60000n },
    metadata: {
        bookingId: 'booking',
        program: 'party-checkout',
        customerEmail: 'parent@example.com',
        ...(giftCardCents && { giftCardId: 'gift', giftCardCents: String(giftCardCents) }),
    },
    tenders: state === 'COMPLETED' ? [{ paymentId: 'terminal-payment' }] : [],
})
const start = (options: { receiptScreen?: boolean } = {}) =>
    startTerminalPayment({
        checkoutId: 'order',
        deviceId: 'device',
        note: "Mia's 7th party",
        metadata,
        referenceId: 'booking',
        receiptScreen: options.receiptScreen ?? false,
    })
const status = () => getTerminalPayment({ checkoutId: 'order', terminalCheckoutId: 'terminal', metadata })

beforeEach(() => {
    vi.clearAllMocks()
    square.orders.get.mockResolvedValue({ order: order() })
    square.orders.pay.mockResolvedValue({})
    square.payments.create.mockResolvedValue({ payment: { id: 'gift-payment', status: 'APPROVED' } })
    square.payments.cancel.mockResolvedValue({})
    square.payments.get.mockResolvedValue({ payment: { status: 'COMPLETED', receiptUrl: 'https://receipt' } })
    square.terminal.checkouts.create.mockResolvedValue({ checkout: { id: 'terminal' } })
    square.terminal.checkouts.cancel.mockResolvedValue({})
    square.terminal.checkouts.get.mockResolvedValue({ checkout: { orderId: 'order', status: 'IN_PROGRESS' } })
})

describe('starting a terminal payment', () => {
    it('sends the order total to the terminal, held until the order is paid, with no tipping or receipt screen', async () => {
        expect(await start()).toEqual({ status: 'waiting', terminalCheckoutId: 'terminal' })
        expect(square.payments.create).not.toHaveBeenCalled()
        expect(square.terminal.checkouts.create).toHaveBeenCalledWith({
            idempotencyKey: 'order-terminal',
            checkout: expect.objectContaining({
                amountMoney: { currency: 'AUD', amount: 60000n },
                orderId: 'order',
                referenceId: 'booking',
                customerId: 'customer',
                note: "Mia's 7th party",
                paymentOptions: { autocomplete: false },
                deviceOptions: { deviceId: 'device', skipReceiptScreen: true, tipSettings: { allowTipping: false } },
            }),
        })
    })

    it('lets the terminal offer a receipt when the booking flow asks', async () => {
        await start({ receiptScreen: true })
        expect(square.terminal.checkouts.create.mock.calls[0][0].checkout.deviceOptions.skipReceiptScreen).toBe(false)
    })

    it('authorises the gift-card share and sends only the rest to the terminal', async () => {
        square.orders.get.mockResolvedValue({ order: order(20000) })
        await start()
        expect(square.payments.create).toHaveBeenCalledWith(
            expect.objectContaining({
                idempotencyKey: 'order-gift',
                sourceId: 'gift',
                autocomplete: false,
                orderId: 'order',
                amountMoney: { currency: 'AUD', amount: 20000n },
            })
        )
        expect(square.terminal.checkouts.create.mock.calls[0][0].checkout.amountMoney.amount).toBe(40000n)
    })

    it('pays straight away when the gift card covers everything', async () => {
        square.orders.get.mockResolvedValue({ order: order(60000) })
        expect(await start()).toEqual({ status: 'paid', receiptUrl: 'https://receipt' })
        expect(square.terminal.checkouts.create).not.toHaveBeenCalled()
        expect(square.orders.pay).toHaveBeenCalledWith(expect.objectContaining({ paymentIds: ['gift-payment'] }))
    })

    it('rejects an order prepared for a different booking', async () => {
        await expect(
            startTerminalPayment({
                checkoutId: 'order',
                deviceId: 'device',
                note: '',
                metadata: { bookingId: 'other' },
                receiptScreen: false,
            })
        ).rejects.toThrow('different booking')
        expect(square.terminal.checkouts.create).not.toHaveBeenCalled()
    })

    it('releases the gift-card share when the terminal refuses the charge', async () => {
        square.orders.get.mockResolvedValue({ order: order(20000) })
        square.terminal.checkouts.create.mockRejectedValue({ statusCode: 400 })
        square.payments.get.mockResolvedValue({ payment: { status: 'APPROVED' } })
        await expect(start()).rejects.toThrow('Unable to send the charge to the terminal')
        expect(square.payments.cancel).toHaveBeenCalledWith({ paymentId: 'gift-payment' })
    })
})

describe('checking a terminal payment', () => {
    it('keeps waiting while the terminal has it', async () => {
        expect(await status()).toEqual({ status: 'waiting', terminalCheckoutId: 'terminal' })
        expect(square.orders.pay).not.toHaveBeenCalled()
    })

    it('pays the order with the gift card and terminal payments once the customer pays', async () => {
        square.orders.get.mockResolvedValue({ order: order(20000) })
        square.terminal.checkouts.get.mockResolvedValue({
            checkout: { orderId: 'order', status: 'COMPLETED', paymentIds: ['terminal-payment'] },
        })
        expect(await status()).toEqual({ status: 'paid', receiptUrl: 'https://receipt' })
        expect(square.orders.pay).toHaveBeenCalledWith({
            orderId: 'order',
            paymentIds: ['gift-payment', 'terminal-payment'],
            idempotencyKey: 'order-pay',
        })
    })

    it('reports an order that is already paid without paying it again', async () => {
        square.orders.get.mockResolvedValue({ order: order(0, 'COMPLETED') })
        square.terminal.checkouts.get.mockResolvedValue({ checkout: { orderId: 'order', status: 'COMPLETED' } })
        expect(await status()).toEqual({ status: 'paid', receiptUrl: 'https://receipt' })
        expect(square.orders.pay).not.toHaveBeenCalled()
    })

    it('says why a charge was cancelled, and releases the gift-card share', async () => {
        square.orders.get.mockResolvedValue({ order: order(20000) })
        square.payments.get.mockResolvedValue({ payment: { status: 'APPROVED' } })
        square.terminal.checkouts.get.mockResolvedValue({
            checkout: { orderId: 'order', status: 'CANCELED', cancelReason: 'BUYER_CANCELED' },
        })
        expect(await status()).toEqual({
            status: 'canceled',
            reason: 'The customer cancelled the payment on the terminal.',
        })
        expect(square.payments.cancel).toHaveBeenCalledWith({ paymentId: 'gift-payment' })
    })

    it("doesn't cancel a gift-card share that's already released", async () => {
        square.orders.get.mockResolvedValue({ order: order(20000) })
        square.payments.get.mockResolvedValue({ payment: { status: 'CANCELED' } })
        square.terminal.checkouts.get.mockResolvedValue({
            checkout: { orderId: 'order', status: 'CANCELED', cancelReason: 'TIMED_OUT' },
        })
        expect(await status()).toMatchObject({ reason: 'The terminal timed out before the customer paid.' })
        expect(square.payments.cancel).not.toHaveBeenCalled()
    })

    it('rejects a terminal checkout for a different order', async () => {
        square.terminal.checkouts.get.mockResolvedValue({ checkout: { orderId: 'other', status: 'COMPLETED' } })
        await expect(status()).rejects.toThrow('different order')
    })
})

describe('cancelling a terminal payment', () => {
    it('asks the terminal to cancel, and ignores a checkout that has already finished', async () => {
        await cancelTerminalPayment('terminal')
        expect(square.terminal.checkouts.cancel).toHaveBeenCalledWith({ checkoutId: 'terminal' })

        square.terminal.checkouts.cancel.mockRejectedValue({ statusCode: 400 })
        await expect(cancelTerminalPayment('terminal')).resolves.toBeUndefined()

        square.terminal.checkouts.cancel.mockRejectedValue({ statusCode: 503 })
        await expect(cancelTerminalPayment('terminal')).rejects.toEqual({ statusCode: 503 })
    })
})
