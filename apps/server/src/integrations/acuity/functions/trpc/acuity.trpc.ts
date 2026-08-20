import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants } from '@fizz-kidz/core'

import { mergeAcuityWithSanity } from '../../core/merge-sanity-with-acuity'

import { acuityAuthenticatedProcedure, acuityPublicProcedure, router } from '@/app/trpc/trpc'

export const acuityRouter = router({
    updateLabel: acuityAuthenticatedProcedure
        .input((input: unknown) => input as AcuityTypes.Client.UpdateLabelParams)
        .mutation(({ ctx, input }) => ctx.acuityClient.updateLabel(input)),
    getAppointmentTypes: acuityPublicProcedure
        .input((input: unknown) => input as AcuityTypes.Client.GetAppointmentTypesParams)
        .query(({ ctx, input }) => ctx.acuityClient.getAppointmentTypes(input)),
    updateAppointment: acuityPublicProcedure
        .input((input: unknown) => input as AcuityTypes.Client.UpdateAppointmentParams)
        .mutation(({ ctx, input }) => ctx.acuityClient.updateAppointment(input)),
    searchForAppointmentsMutation: acuityAuthenticatedProcedure
        .input((input: unknown) => input as AcuityTypes.Client.FetchAppointmentsParams)
        .mutation(({ ctx, input }) => ctx.acuityClient.searchForAppointments(input)),
    searchForAppointments: acuityAuthenticatedProcedure
        .input((input: unknown) => input as AcuityTypes.Client.FetchAppointmentsParams)
        .query(({ ctx, input }) => ctx.acuityClient.searchForAppointments(input)),
    getAppointments: acuityPublicProcedure
        .input((input: unknown) => input as AcuityTypes.Client.GetAppointmentsParams)
        .query(({ ctx, input }) => ctx.acuityClient.getAppointments(input.ids)),
    getCalendars: acuityPublicProcedure.query(({ ctx }) => ctx.acuityClient.getCalendars()),
    classAvailability: acuityPublicProcedure
        .input((input: unknown) => input as AcuityTypes.Client.ClassAvailabilityParams)
        .query(
            /***
             * Returns acuity classes, but in the case the class is a holiday program, it will additionally return the title and creations.
             */
            async ({ ctx, input }): Promise<AcuityTypes.Client.Class[]> => {
                const acuityPrograms = await ctx.acuityClient.getClasses(
                    input.appointmentTypeIds,
                    input.includeUnavailable,
                    input.minDate
                )

                // For holiday programs, add the public schedule details managed in Sanity.
                if (
                    input.appointmentTypeIds.includes(AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM) ||
                    input.appointmentTypeIds.includes(AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM)
                ) {
                    const mergedPrograms = await mergeAcuityWithSanity(acuityPrograms)
                    return mergedPrograms
                }

                return acuityPrograms
            }
        ),
})
