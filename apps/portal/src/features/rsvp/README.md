# Invitations And RSVPs: Portal

One invitation, two experiences:

- Guests see the invite and can RSVP without an account.
- Owners and organization staff see the live guest list.

`pages/view-invitation-page.tsx` decides which experience to show.

## Routes

- `/invite/:invitationId` is the stable share page.
- `/invite/:invitationId/rsvp` is reached from that page and relies on router state. A refresh returns to the share page.
- `/api/webhooks/invitation/:bookingId` is the durable host entry and redirects to create or manage.

## Who Can Do What

Owners can edit the invitation, replace its design, change notifications, share/download it, and add host-entered RSVPs. Organization staff can view the management screen and maintain existing responses, but do not gain owner-only controls.

Guests cannot edit a submitted response. Guest submissions require each child's date of birth and send confirmation email; host-entered responses deliberately skip those guest side effects.

Creating or saving an invitation requires Firebase sign-in. The `returnTo` query parameter brings the host back after authentication.

Server lifecycle: [`apps/server/src/features/party-bookings/core/rsvp/README.md`](../../../../server/src/features/party-bookings/core/rsvp/README.md).
