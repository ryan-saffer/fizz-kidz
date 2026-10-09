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

## The Birthday Line

The image prints one line such as "Mia's 4th & John's 3rd". An invitation has no list of children, only free-text `childName` and `childAge`. Both are prefilled from the booking ("Mia & John" / "4 & 3"), but the host can retype them, so `formatInvitationBirthday` pairs names with ages only when it is unambiguous. Both fields are split on `,`, `&` or `and`:

| Input                           | Rule                                                                                                                                        | Printed                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| "Mia & John" / "4 & 3"          | Every age is a number and there is one per name: pair them                                                                                  | Mia's 4th & John's 3rd      |
| "Lachie & Matthew" / "6"        | One numeric age is shared                                                                                                                   | Lachie & Matthew's 6th      |
| "Mia, John & Sam" / "4 & 3"     | Ages don't line up with the names (e.g. twins plus a sibling), so we can't tell whose is whose: keep the names together and suffix each age | Mia, John & Sam's 4th & 3rd |
| "john and mia" / "five and six" | An age isn't a number: keep it as typed                                                                                                     | john and mia's five and six |

Each design has a `maxWidth` for this line, measured from its artwork. Longer lines shrink their font to stay on one line inside the design.

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
