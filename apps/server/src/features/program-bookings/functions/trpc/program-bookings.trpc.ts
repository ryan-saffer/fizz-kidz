import { z } from 'zod'

import { publicProcedure, router } from '@/app/trpc/trpc'
import {
    cancelManagedAppointment,
    getCancellationRefund,
    getManagedAppointment,
    getRescheduleSessions,
    rescheduleManagedAppointment,
} from '@/features/program-bookings/core/manage-appointment'

// public, but every call needs the signed token from the confirmation email
const appointmentAccess = z.object({ appointmentId: z.number(), token: z.string() })

export const programBookingsRouter = router({
    getManagedAppointment: publicProcedure.input(appointmentAccess).query(({ input }) => getManagedAppointment(input)),
    rescheduleSessions: publicProcedure.input(appointmentAccess).query(({ input }) => getRescheduleSessions(input)),
    cancellationRefund: publicProcedure.input(appointmentAccess).query(({ input }) => getCancellationRefund(input)),
    cancelAppointment: publicProcedure
        .input(appointmentAccess)
        .mutation(({ input }) => cancelManagedAppointment(input)),
    rescheduleAppointment: publicProcedure
        .input(appointmentAccess.extend({ classId: z.number() }))
        .mutation(({ input }) => rescheduleManagedAppointment(input)),
})
