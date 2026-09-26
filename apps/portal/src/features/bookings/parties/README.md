# Party bookings

The parties on the bookings page (`/dashboard/bookings`): each day's list, a booking's details, and booking, editing and deleting a party. Built with shadcn/ui, TanStack Form, zod and Zustand. Events and incursions on the same page are still the older MUI screens in `../events`.

## How it works

Start with `state/party-bookings-store.ts`. The store holds how the feature works: which booking the dialog is creating or editing, saving it, deleting with a lost reason, and the booking menu's links and emails. Components read from it and call its actions rather than passing state down. `PartyBookingDialog` is mounted once on the page and registers the tRPC mutations and the page's date navigation with the store.

- `state/party-booking-form.ts` is the TanStack form: the answers for both modes, their defaults, reading an existing booking, CRM prefill links (`?parentName=…&type=…`), and turning the answers into the `Booking` the server saves.
- `state/party-booking-schema.ts` holds the rules as zod schemas. Field rules are declared per field; rules that depend on the party type (lengths, address for mobile, food for studio) are in one refinement, which zod runs even while other fields are invalid. The form checks everything on save and then as fields change.
- `hooks/use-party-bookings.ts` streams the day's bookings from Firestore, or a single booking from a calendar link (`?id=<bookingId>`), which opens it.
- `components/party-booking-card.tsx` is a party on the list; opening it shows `party-booking-summary.tsx`, the booking in three colour-coded sections (party details, food, notes), under `party-booking-actions.tsx` (edit, RSVPs, links, email, delete).
- `components/party-booking-dialog.tsx` is the full screen dialog for booking or editing, and `delete-party-booking-dialog.tsx` asks why the party was lost.
- `components/form/` has the form and its fields. `fields.tsx` wraps shadcn inputs for TanStack fields; `creation-field.tsx` groups creations by package using `utils/creation-menu.ts`.
- `utils/display.ts` formats times, creations, additions and purchased goodies for the summary.

## Creating and editing

A new booking collects each birthday child (name, birthday, and the age they're turning, filled in from the birthday); the booking's `childName` and `childAge` are joined from them. Creations, food additions, questions and fun facts come later from the parent's party form, so they're only in the edit form.

Editing saves the whole booking with the answers over the existing one, so fields the form doesn't show (event id, cake, invitation…) are kept. Type and studio can't change once booked, because the calendar event belongs to them. A cleared creation is saved as `''`, because the server updates the booking field by field. Existing bookings only need a mobile number, since older bookings hold other formats; new ones need 10 digits.

Cake, take-home bags and products are bought through the party form and are read-only here.

## Tests

Tests live in a `__tests__` folder next to the file they cover.

```bash
vp test --run --project portal apps/portal/src/features/bookings
```
