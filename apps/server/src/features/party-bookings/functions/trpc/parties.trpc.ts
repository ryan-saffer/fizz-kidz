import { z } from 'zod'

import {
    partyTerminalCheckoutSchema,
    preparePartyCheckoutSchema,
    preparePartyFormSchema,
    startPartyCheckoutSchema,
    submitPartyFormSchema,
} from '@fizz-kidz/core'
import type { Booking, Invitations, PartyLostReason, Studio, WithoutId, WithoutUid } from '@fizz-kidz/core'

import type { HostRsvpProps, RsvpProps } from '@/features/party-bookings/core/rsvp/rsvp-to-party'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { authenticatedProcedure, publicProcedure, router } from '@/app/trpc/trpc'
import { createPartyBooking } from '@/features/party-bookings/core/create-party-booking'
import { deletePartyBooking } from '@/features/party-bookings/core/delete-party-booking'
import {
    cancelPartyCheckout,
    getPartyCheckoutStatus,
    startPartyCheckout,
} from '@/features/party-bookings/core/party-checkout/charge-party-checkout'
import { getPartyCheckout } from '@/features/party-bookings/core/party-checkout/get-party-checkout'
import { preparePartyCheckout } from '@/features/party-bookings/core/party-checkout/prepare-party-checkout'
import { preparePartyForm } from '@/features/party-bookings/core/party-form/checkout/prepare-party-form'
import { submitPartyForm } from '@/features/party-bookings/core/party-form/checkout/submit-party-form'
import { getPartyFormConfig } from '@/features/party-bookings/core/party-form/config/get-party-form-config'
import { getCakeFormUrl, getPartyFormUrl } from '@/features/party-bookings/core/party-form/party-form-urls'
import { generateAndLinkInvitation } from '@/features/party-bookings/core/rsvp/edit-invitation'
import { generateInvitation } from '@/features/party-bookings/core/rsvp/generate-invitation'
import { generateInvitationUrl } from '@/features/party-bookings/core/rsvp/generate-invitation-url'
import { getInvitationDownloadUrl } from '@/features/party-bookings/core/rsvp/get-invitation-download-url'
import { linkInvitation } from '@/features/party-bookings/core/rsvp/link-invitation'
import { resetInvitation } from '@/features/party-bookings/core/rsvp/reset-invitation'
import { hostRsvpToParty, guestRsvpToParty } from '@/features/party-bookings/core/rsvp/rsvp-to-party'
import { sendPartyBookingConfirmationEmail } from '@/features/party-bookings/core/send-party-booking-confirmation-email'
import { updatePartyBooking } from '@/features/party-bookings/core/update-party-booking'
import { UnavailableBirthdayPartyCreationsError } from '@/features/party-bookings/core/validate-booking-creations'
import { DatabaseClient } from '@/integrations/firebase/database.client'

export type CreatePartyBooking = Booking
export type UpdatePartyBooking = { bookingId: string; booking: Booking }

export type DeletePartyBooking = {
    bookingId: string
    eventId: string
    location: Studio
    type: Booking['type']
    lostReason: PartyLostReason
    lostReasonOtherDetails: string | undefined
}

async function handleBookingCreationValidation<T>(operation: () => Promise<T>) {
    try {
        return await operation()
    } catch (error) {
        if (error instanceof UnavailableBirthdayPartyCreationsError) {
            throwTrpcError('BAD_REQUEST', error.message, error, {
                invalidKeys: error.invalidKeys,
                type: error.bookingType,
            })
        }
        throw error
    }
}

export const partiesRouter = router({
    createPartyBooking: authenticatedProcedure
        .input((input: unknown) => input as CreatePartyBooking)
        .mutation(({ input }) => handleBookingCreationValidation(() => createPartyBooking(input))),
    updatePartyBooking: authenticatedProcedure
        .input((input: unknown) => input as UpdatePartyBooking)
        .mutation(({ input }) => handleBookingCreationValidation(() => updatePartyBooking(input))),
    deletePartyBooking: authenticatedProcedure
        .input((input: unknown) => input as DeletePartyBooking)
        .mutation(({ input }) => deletePartyBooking(input)),
    getPartyFormUrl: authenticatedProcedure
        .input((input: unknown) => input as { bookingId: string })
        .mutation(({ input }) => getPartyFormUrl(input.bookingId)),
    getCakeFormUrl: authenticatedProcedure
        .input((input: unknown) => input as { bookingId: string })
        .mutation(({ input }) => getCakeFormUrl(input.bookingId)),
    resendPartyBookingConfirmationEmail: authenticatedProcedure
        .input(z.object({ bookingId: z.string() }))
        .mutation(async ({ input }) => {
            const booking = await DatabaseClient.getPartyBooking(input.bookingId)

            try {
                await sendPartyBookingConfirmationEmail({ bookingId: input.bookingId, booking })
            } catch (err) {
                throwTrpcError('INTERNAL_SERVER_ERROR', 'Unable to resend party booking confirmation email', err, input)
            }
        }),
    getPartyFormConfig: publicProcedure
        .input(z.object({ bookingId: z.string() }))
        .query(({ input }) => getPartyFormConfig(input.bookingId)),
    preparePartyForm: publicProcedure.input(preparePartyFormSchema).mutation(({ input }) => preparePartyForm(input)),
    submitPartyForm: publicProcedure.input(submitPartyFormSchema).mutation(({ input }) => submitPartyForm(input)),
    getPartyCheckout: authenticatedProcedure
        .input(z.object({ bookingId: z.string() }))
        .query(({ input, ctx }) => getPartyCheckout(input.bookingId, ctx.uid)),
    preparePartyCheckout: authenticatedProcedure
        .input(preparePartyCheckoutSchema)
        .mutation(({ input, ctx }) => preparePartyCheckout(input, ctx.uid)),
    startPartyCheckout: authenticatedProcedure
        .input(startPartyCheckoutSchema)
        .mutation(({ input, ctx }) => startPartyCheckout(input, ctx.uid)),
    getPartyCheckoutStatus: authenticatedProcedure
        .input(partyTerminalCheckoutSchema)
        .mutation(({ input }) => getPartyCheckoutStatus(input)),
    cancelPartyCheckout: authenticatedProcedure
        .input(partyTerminalCheckoutSchema)
        .mutation(({ input }) => cancelPartyCheckout(input)),
    generateInvitationUrl: authenticatedProcedure
        .input(z.object({ bookingId: z.string() }))
        .mutation(({ input }) => generateInvitationUrl(input.bookingId)),
    getInvitationDownloadUrl: authenticatedProcedure
        .input(z.object({ invitationId: z.string() }))
        .mutation(({ input, ctx }) => getInvitationDownloadUrl({ ...input, distinctId: ctx.email })),
    generateInvitation: publicProcedure
        .input((input: unknown) => input as WithoutId<WithoutUid<Invitations.Invitation>>)
        .mutation(({ input }) => generateInvitation(input)),
    linkInvitation: authenticatedProcedure
        .input((input: unknown) => input as WithoutUid<Invitations.Invitation>)
        .mutation(({ input, ctx }) => linkInvitation({ ...input, uid: ctx.uid }, ctx.email)),
    generateAndLinkInvitation: authenticatedProcedure
        .input((input: unknown) => input as Invitations.Invitation)
        .mutation(({ input, ctx }) => generateAndLinkInvitation({ ...input, uid: ctx.uid }, ctx.email)),
    resetInvitation: authenticatedProcedure
        .input((input: unknown) => input as { invitationId: string })
        .mutation(({ input }) => resetInvitation(input.invitationId)),
    guestRsvp: publicProcedure
        .input((input: unknown) => input as WithoutId<RsvpProps>)
        .mutation(({ input }) => guestRsvpToParty(input)),
    hostRsvp: authenticatedProcedure
        .input((input: unknown) => input as WithoutId<HostRsvpProps>)
        .mutation(({ input, ctx }) => hostRsvpToParty(input, { uid: ctx.uid, email: ctx.email })),
})
