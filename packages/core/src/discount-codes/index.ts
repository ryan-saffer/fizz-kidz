export type DiscountCode = {
    id: string
    discountType: 'percentage' | 'price'
    discountAmount: number
    code: string
    expiryDate: Date
    numberOfUses: number
    numberOfUsesAllocated: number
    limitToOneUsePerCustomer?: boolean
}

export type DiscountCodeRedemption = {
    id: string
    code: string
    normalizedCode: string
    customerEmail: string
    normalizedCustomerEmail: string
    redemptionKey: string
    customerName: string
    bookingType: 'holiday-program' | 'preschool-program-v2' | 'party-form' | 'party-checkout' | 'pos'
    amountCents: number
    discountType: DiscountCode['discountType']
    discountAmount: number
    appointmentIds: string[]
    idempotencyKey: string
    usedAt: Date
}
