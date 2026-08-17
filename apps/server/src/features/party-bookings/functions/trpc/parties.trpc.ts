import { z } from 'zod'

import type {
    Booking,
    GenerateInvitation,
    InvitationsV2,
    PartyLostReason,
    Studio,
    WithoutId,
    WithoutUid,
} from '@fizz-kidz/core'

import type { HostRsvpProps, RsvpProps } from '@/features/party-bookings/core/rsvp/rsvp-to-party-v2'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { authenticatedProcedure, publicProcedure, router } from '@/app/trpc/trpc'
import { createPartyBooking } from '@/features/party-bookings/core/create-party-booking'
import { deletePartyBooking } from '@/features/party-bookings/core/delete-party-booking'
import { generateInvitation } from '@/features/party-bookings/core/generate-invitation'
import { getCakeFormUrl, getPartyFormUrl } from '@/features/party-bookings/core/party-form-urls'
import { generateAndLinkInvitation } from '@/features/party-bookings/core/rsvp/edit-invitation-v2'
import { generateInvitationUrl } from '@/features/party-bookings/core/rsvp/generate-invitation-url'
import { generateInvitationV2 } from '@/features/party-bookings/core/rsvp/generate-invitation-v2'
import { getInvitationDownloadUrl } from '@/features/party-bookings/core/rsvp/get-invitation-download-url-v2'
import { linkInvitation } from '@/features/party-bookings/core/rsvp/link-invitation-v2'
import { resetInvitation } from '@/features/party-bookings/core/rsvp/reset-invitation-v2'
import { hostRsvpToParty, guestRsvpToParty } from '@/features/party-bookings/core/rsvp/rsvp-to-party-v2'
import { sendPartyBookingConfirmationEmail } from '@/features/party-bookings/core/send-party-booking-confirmation-email'
import { updatePartyBooking } from '@/features/party-bookings/core/update-party-booking'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { getPartyFormEmbedConfig } from '@/integrations/paperforms/core/party-form-prefill'

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

export const partiesRouter = router({
    createPartyBooking: authenticatedProcedure
        .input((input: unknown) => input as CreatePartyBooking)
        .mutation(({ input }) => createPartyBooking(input)),
    updatePartyBooking: authenticatedProcedure
        .input((input: unknown) => input as UpdatePartyBooking)
        .mutation(({ input }) => updatePartyBooking(input)),
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
    getPaperformEmbedConfig: publicProcedure
        .input(z.object({ bookingId: z.string(), partyOrCakeForm: z.enum(['party', 'cake']) }))
        .query(({ input }) => getPartyFormEmbedConfig(input.bookingId, input.partyOrCakeForm)),
    generateInvitation: publicProcedure
        .input((input: unknown) => input as GenerateInvitation)
        .mutation(({ input }) => generateInvitation(input)),
    generateInvitationUrl: authenticatedProcedure
        .input(z.object({ bookingId: z.string() }))
        .mutation(({ input }) => generateInvitationUrl(input.bookingId)),
    getInvitationDownloadUrl: authenticatedProcedure
        .input(z.object({ invitationId: z.string() }))
        .mutation(({ input, ctx }) => getInvitationDownloadUrl({ ...input, distinctId: ctx.email })),
    generateInvitationV2: publicProcedure
        .input((input: unknown) => input as WithoutId<WithoutUid<InvitationsV2.Invitation>>)
        .mutation(({ input }) => generateInvitationV2(input)),
    linkInvitation: authenticatedProcedure
        .input((input: unknown) => input as WithoutUid<InvitationsV2.Invitation>)
        .mutation(({ input, ctx }) => linkInvitation({ ...input, uid: ctx.uid }, ctx.email)),
    generateAndLinkInvitation: authenticatedProcedure
        .input((input: unknown) => input as InvitationsV2.Invitation)
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
