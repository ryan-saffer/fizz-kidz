import { z } from 'zod'

import { publicProcedure, authenticatedProcedure, router } from '@/app/trpc/trpc'
import { checkGiftCardBalance } from '@/features/gift-cards/check-gift-card-balance'
import {
    type HolidayProgramBookingProps,
    bookHolidayProgram,
} from '@/features/holiday-programs/core/book-holiday-program'
import { checkDiscountCode } from '@/features/holiday-programs/core/discount-codes/check-discount-code'
import {
    type CreateDiscountCode,
    createDiscountCode,
} from '@/features/holiday-programs/core/discount-codes/create-discount-code'
import {
    type CreateDiscountCodeFromInvitation,
    createDiscountCodeFromInvitation,
} from '@/features/holiday-programs/core/discount-codes/create-discount-code-from-invitation'
import {
    cancelManagedAppointment,
    getManagedAppointment,
    getRescheduleSessions,
    rescheduleManagedAppointment,
} from '@/features/holiday-programs/core/manage-appointment'
import { getMedicalPlanUrl } from '@/features/medical-plans/get-medical-plan-url'
import { MEDICAL_PLAN_PREFIXES } from '@/features/medical-plans/medical-plan-path'

const appointmentAccess = z.object({ appointmentId: z.number(), token: z.string() })

export const holidayProgramsRouter = router({
    getManagedAppointment: publicProcedure.input(appointmentAccess).query(({ input }) => getManagedAppointment(input)),
    rescheduleSessions: publicProcedure.input(appointmentAccess).query(({ input }) => getRescheduleSessions(input)),
    cancelAppointment: publicProcedure
        .input(appointmentAccess)
        .mutation(({ input }) => cancelManagedAppointment(input)),
    rescheduleAppointment: publicProcedure
        .input(appointmentAccess.extend({ classId: z.number() }))
        .mutation(({ input }) => rescheduleManagedAppointment(input)),
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
