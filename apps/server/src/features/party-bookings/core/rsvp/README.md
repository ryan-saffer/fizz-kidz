# Invitations And RSVPs: Server

Invitations can change; the guest list must not. That is the idea behind this feature.

- A booking stores the stable `invitationId` and `invitationOwnerUid`.
- The invitation stores its design and creating user's `uid`.
- RSVPs live under the booking, separate from the image.
- Each response records whether it came from a `guest` or the `host`.

## Lifecycle

The design flow creates a stable ID and a PNG in temporary storage. Linking moves the PNG to its permanent path and connects the invitation to the booking.

An edit replaces the invitation document and image while keeping the same ID. Old links and printed QR codes continue to work; RSVPs stay untouched.

`resetInvitation` fully unlinks an invitation, but only exists as a testing utility.

## Access And Side Effects

- Guest RSVPs require date of birth, update CRM data, and send confirmation email.
- Owners can add host-entered RSVPs; these skip date of birth, guest CRM, and guest email.
- Owners and organization staff can update or delete existing responses.
- Editing the invitation, changing notifications, and adding host responses remain owner-only.

## Links

- Share: `/invite/:invitationId`
- RSVP: `/invite/:invitationId/rsvp`, reached from the share page
- Durable host entry: `/api/webhooks/invitation/:bookingId`

The QR code points to the share page.

Portal details: [`apps/portal/src/features/rsvp/README.md`](../../../../../../portal/src/features/rsvp/README.md).
