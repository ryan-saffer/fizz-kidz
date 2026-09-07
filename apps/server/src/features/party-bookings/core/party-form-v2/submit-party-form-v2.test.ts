import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { submitPartyFormV2 } from './submit-party-form-v2'

import type { PartyFormV2PaymentRecord } from '@/integrations/firebase/firestore.refs'

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    update: vi.fn(),
    claim: vi.fn(),
    redeem: vi.fn(),
    pay: vi.fn(),
    complete: vi.fn(),
    getOrder: vi.fn(),
    gift: vi.fn(),
    reserve: vi.fn(),
    release: vi.fn(),
}))
vi.mock('@/integrations/firebase/database.client', () => ({
    DatabaseClient: {
        getPartyFormV2Submission: mocks.get,
        updatePartyFormV2Payment: mocks.update,
        claimPartyFormV2Payment: mocks.claim,
        recordPartyFormV2DiscountRedemption: mocks.redeem,
        reservePartyFormV2Discount: mocks.reserve,
        releasePartyFormV2Discount: mocks.release,
    },
}))
vi.mock('./pay-party-form-v2-order', () => ({ payPartyFormV2Order: mocks.pay }))
vi.mock('./process-party-form-v2', () => ({ processPartyFormV2Submission: mocks.complete }))
vi.mock('@/integrations/observability/log-error', () => ({ logError: vi.fn() }))
vi.mock('@/integrations/square/square.client', () => ({
    SquareClient: { getInstance: async () => ({ orders: { get: mocks.getOrder }, giftCards: { get: mocks.gift } }) },
}))
vi.mock('@/features/holiday-programs/core/discount-codes/check-discount-code', () => ({
    getDiscountCodeRedemptionKey: () => 'redemption-key',
}))

let payment: PartyFormV2PaymentRecord
const input = { submissionId: '2b323edb-756e-490b-a48e-2a5f6c16d6a0', token: 'token', buyerVerificationToken: '' }
beforeEach(() => {
    vi.clearAllMocks()
    payment = {
        orderId: 'order',
        giftCardId: '',
        discount: null,
        state: 'ready',
        leaseUntil: 0,
        receiptUrl: null,
        createdAt: 0,
        summary: {
            submissionId: input.submissionId,
            locationId: 'location',
            parentEmail: 'parent@example.com',
            subtotalCents: 1000,
            discountCents: 0,
            discountCode: '',
            totalCents: 1000,
            giftCardCents: 0,
            giftCardLast4: '',
            cardCents: 1000,
            items: [],
        },
    }
    mocks.get.mockImplementation(async () => ({
        payload: { parentFirstName: 'Parent', parentLastName: 'Test' },
        payment: structuredClone(payment),
    }))
    mocks.update.mockImplementation(async (_id, buildUpdate) => {
        payment = { ...payment, ...buildUpdate(structuredClone(payment)) }
        return structuredClone(payment)
    })
    mocks.claim.mockResolvedValue(true)
    mocks.pay.mockResolvedValue('https://receipt.example.com')
    mocks.reserve.mockReset()
    mocks.complete.mockResolvedValue('completed')
    mocks.getOrder.mockResolvedValue({
        order: { state: 'OPEN', locationId: 'location', totalMoney: { amount: 1000n } },
    })
})

describe('party form checkout submission', () => {
    it('charges and completes once, returning the stored result on replay', async () => {
        expect(await submitPartyFormV2(input)).toEqual({
            status: 'completed',
            receiptUrl: 'https://receipt.example.com',
        })
        expect(await submitPartyFormV2(input)).toEqual({
            status: 'completed',
            receiptUrl: 'https://receipt.example.com',
        })
        expect(mocks.pay).toHaveBeenCalledTimes(1)
        expect(mocks.complete).toHaveBeenCalledTimes(1)
    })
    it('reports an in-flight request as processing rather than success', async () => {
        mocks.claim.mockResolvedValue(false)
        expect(await submitPartyFormV2(input)).toEqual({ status: 'processing' })
        expect(mocks.pay).not.toHaveBeenCalled()
        expect(mocks.complete).not.toHaveBeenCalled()
    })
    it('reconciles a completed Square order after a lost response without another charge', async () => {
        payment.state = 'paying'
        mocks.getOrder.mockResolvedValue({ order: { state: 'COMPLETED' } })
        expect((await submitPartyFormV2(input)).status).toBe('completed')
        expect(mocks.pay).not.toHaveBeenCalled()
        expect(mocks.complete).toHaveBeenCalledTimes(1)
    })
    it('does not charge again when fulfilment fails after payment', async () => {
        mocks.complete.mockRejectedValueOnce(new Error('Database unavailable'))
        expect(await submitPartyFormV2(input)).toEqual({ status: 'processing' })
        expect(payment.state).toBe('paid')
        expect((await submitPartyFormV2(input)).status).toBe('completed')
        expect(mocks.pay).toHaveBeenCalledTimes(1)
    })
    it('rejects a changed gift-card balance before charging', async () => {
        payment.summary.giftCardCents = 1000
        payment.summary.cardCents = 0
        payment.giftCardId = 'gift'
        mocks.gift.mockResolvedValue({ giftCard: { state: 'ACTIVE', balanceMoney: { currency: 'AUD', amount: 300n } } })
        await expect(submitPartyFormV2({ ...input, token: '' })).rejects.toThrow('balance has changed')
        expect(mocks.pay).not.toHaveBeenCalled()
        expect(payment.state).toBe('failed')
    })
    it('revalidates discount codes at payment time', async () => {
        payment.discount = { id: 'code-id', code: 'SAVE', discountType: 'price', discountAmount: 10 }
        mocks.reserve.mockImplementation(async (_submissionId, _discountId, _redemptionKey, validate) =>
            validate(
                {
                    ...payment.discount,
                    numberOfUses: 10,
                    numberOfUsesAllocated: 10,
                    expiryDate: new Date('2099-01-01'),
                },
                false
            )
        )
        await expect(submitPartyFormV2(input)).rejects.toThrow('no longer available')
        expect(mocks.pay).not.toHaveBeenCalled()
    })

    it('resumes validation if a process stopped after taking the lease but before reserving the discount', async () => {
        payment.state = 'paying'
        payment.discount = { id: 'code-id', code: 'SAVE', discountType: 'price', discountAmount: 10 }
        mocks.reserve.mockImplementation(async (_id, _discountId, _key, validate) =>
            validate(
                { ...payment.discount, expiryDate: new Date('2000-01-01'), numberOfUses: 0, numberOfUsesAllocated: 10 },
                false
            )
        )
        await expect(submitPartyFormV2(input)).rejects.toThrow('no longer available')
        expect(mocks.reserve).toHaveBeenCalledOnce()
        expect(mocks.pay).not.toHaveBeenCalled()
    })

    it('records the completed validation milestone before creating any tenders', async () => {
        mocks.pay.mockImplementation(async () => {
            expect(payment.validated).toBe(true)
            expect(payment.state).toBe('paying')
            return null
        })
        expect((await submitPartyFormV2(input)).status).toBe('completed')
    })

    it('preserves a concurrent discount reservation when reconciling an already paid Square order', async () => {
        payment.discount = { id: 'discount', code: 'SAVE', discountType: 'price', discountAmount: 10 }
        mocks.getOrder.mockImplementationOnce(async () => {
            // Another request reserved the discount after this request read its initial snapshot.
            payment.discountReserved = true
            payment.validated = true
            return { order: { state: 'COMPLETED' } }
        })
        expect((await submitPartyFormV2(input)).status).toBe('completed')
        expect(payment.discountReserved).toBe(true)
        expect(mocks.pay).not.toHaveBeenCalled()
        expect(mocks.redeem).toHaveBeenCalledWith(input.submissionId, expect.objectContaining({ code: 'SAVE' }))
    })
})
