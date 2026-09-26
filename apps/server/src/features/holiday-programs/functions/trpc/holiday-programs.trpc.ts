import { publicProcedure, authenticatedProcedure, router } from '@/app/trpc/trpc'
import { checkDiscountCode } from '@/features/discount-codes/core/check-discount-code'
import { type CreateDiscountCode, createDiscountCode } from '@/features/discount-codes/core/create-discount-code'
import {
    type CreateDiscountCodeFromInvitation,
    createDiscountCodeFromInvitation,
} from '@/features/discount-codes/core/create-discount-code-from-invitation'
import { checkGiftCardBalance } from '@/features/gift-cards/check-gift-card-balance'
import {
    type HolidayProgramBookingProps,
    bookHolidayProgram,
} from '@/features/holiday-programs/core/book-holiday-program'
import { getMedicalPlanUrl } from '@/features/medical-plans/get-medical-plan-url'
import { MEDICAL_PLAN_PREFIXES } from '@/features/medical-plans/medical-plan-path'

export const holidayProgramsRouter = router({
    book: publicProcedure
        .input((input) => input as HolidayProgramBookingProps)
        .mutation(({ input }) => bookHolidayProgram(input)),
    createDiscountCode: authenticatedProcedure
        .input((input: unknown) => input as CreateDiscountCode)
        .mutation(({ input }) => createDiscountCode(input)),
    createDiscountCodeFromInvitation: publicProcedure
        .input((input: unknown) => input as CreateDiscountCodeFromInvitation)
        .mutation(({ input }) => createDiscountCodeFromInvitation(input)),
    checkDiscountCode: publicProcedure
        .input((input: unknown) => input as { code: string; customerEmail?: string })
        .mutation(({ input }) => checkDiscountCode(input.code, input.customerEmail)),
    checkGiftCardBalance: publicProcedure
        .input((input: unknown) => input as { giftCardNumber: string })
        .mutation(({ input }) => checkGiftCardBalance(input.giftCardNumber)),
    getAnaphylaxisPlanUrl: authenticatedProcedure
        .input((input: unknown) => input as { anaphylaxisPlanUrl: string })
        .mutation(({ input }) => getMedicalPlanUrl(input.anaphylaxisPlanUrl, MEDICAL_PLAN_PREFIXES.HOLIDAY_PROGRAM)),
    getAsthmaActionPlanUrl: authenticatedProcedure
        .input((input: unknown) => input as { asthmaActionPlanUrl: string })
        .mutation(({ input }) =>
            getMedicalPlanUrl(input.asthmaActionPlanUrl, MEDICAL_PLAN_PREFIXES.HOLIDAY_PROGRAM_ASTHMA)
        ),
})
