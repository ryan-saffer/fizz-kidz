import type { DiscountCode, WithoutId } from '@fizz-kidz/core'

import { checkDiscountCode } from './check-discount-code'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'

export type CreateDiscountCode = WithoutId<Omit<DiscountCode, 'numberOfUses'>>
/**
 * Creates a discount code.
 * @param discountCode
 */
export async function createDiscountCode(discountCode: CreateDiscountCode) {
    const existingCode = await checkDiscountCode(discountCode.code)
    if (existingCode !== 'not-found') {
        throwTrpcError('PRECONDITION_FAILED', `Discount code '${discountCode.code}' already exists.`)
    }
    discountCode.expiryDate = new Date(discountCode.expiryDate)

    await DatabaseClient.createDiscountCode({
        discountType: discountCode.discountType,
        discountAmount: discountCode.discountAmount,
        code: discountCode.code,
        expiryDate: discountCode.expiryDate,
        numberOfUses: 0,
        numberOfUsesAllocated: discountCode.numberOfUsesAllocated,
        limitToOneUsePerCustomer: discountCode.limitToOneUsePerCustomer ?? false,
    })
}
