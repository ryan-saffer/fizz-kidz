import { authenticatedProcedure, publicProcedure, router } from '@/app/trpc/trpc'
import { checkGiftCardBalance } from '@/features/gift-cards/check-gift-card-balance'
import { getMedicalPlanUrl } from '@/features/medical-plans/get-medical-plan-url'
import { MEDICAL_PLAN_PREFIXES } from '@/features/medical-plans/medical-plan-path'
import {
    bookPreschoolProgramV2,
    type BookPreschoolProgramV2Props,
} from '@/features/preschool-program-v2/core/book-preschool-program-v2'

export const preschoolProgramV2Router = router({
    book: publicProcedure
        .input((input: unknown) => input as BookPreschoolProgramV2Props)
        .mutation(({ input }) => bookPreschoolProgramV2(input)),
    checkGiftCardBalance: publicProcedure
        .input((input: unknown) => input as { giftCardNumber: string })
        .mutation(({ input }) => checkGiftCardBalance(input.giftCardNumber)),
    getAnaphylaxisPlanUrl: authenticatedProcedure
        .input((input: unknown) => input as { storagePath: string })
        .mutation(({ input }) => getMedicalPlanUrl(input.storagePath, MEDICAL_PLAN_PREFIXES.PRESCHOOL_PROGRAM_V2)),
})
