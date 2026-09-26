import { normalize } from '@fizz-kidz/core'

import { throwCustomTrpcError } from '@/app/trpc/transport-errors'
import { DiscountCodeAlreadyRedeemedError } from '@/app/trpc/trpc.errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'

export async function checkDiscountCode(code: string, customerEmail?: string) {
    const existingDiscountCodes = await DatabaseClient.checkDiscountCode(code)
    // each certificate should only exist once in the db. this is enforced when creating codes.
    if (existingDiscountCodes.length > 0) {
        const discountCode = existingDiscountCodes[0]
        if (new Date() > discountCode.expiryDate) {
            return 'expired'
        }
        if (discountCode.numberOfUses >= discountCode.numberOfUsesAllocated) {
            return 'exhausted'
        }
        if (discountCode.limitToOneUsePerCustomer && customerEmail) {
            const redemptions = await DatabaseClient.getDiscountCodeRedemptions(
                getDiscountCodeRedemptionKey(code, customerEmail)
            )
            if (redemptions.length > 0) {
                throwCustomTrpcError(new DiscountCodeAlreadyRedeemedError())
            }
        }
        return discountCode
    }

    return 'not-found'
}

export function getDiscountCodeRedemptionKey(code: string, customerEmail: string) {
    return `${normalize(code)}:${normalize(customerEmail)}`
}
