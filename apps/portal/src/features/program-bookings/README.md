# Program Booking Management

Holiday program, Preschool Program and one-off event confirmation emails link each appointment to `/programs/manage/:appointmentId#token=...`. This public page lets a parent reschedule or cancel one child's session. The token is an HMAC of the appointment ID signed with `ACUITY_API_KEY`, and stays in the URL fragment.

The server (`apps/server/src/features/program-bookings`) reads the program from the Acuity appointment type and applies its rules:

|                | Holiday program                      | Preschool Program                                                 | Event (open days, Halloween, etc.) |
| -------------- | ------------------------------------ | ----------------------------------------------------------------- | ---------------------------------- |
| Reschedule to  | Any later session at the same studio | Any later session at the same studio in the same term, on any day | Not allowed                        |
| Refund preview | Amount paid for the session          | Repriced order, flags when the full-term discount is lost         | Amount paid for the session        |

All programs share a 48-hour cutoff for rescheduling and refunds; cancelling stays open until the session starts. The Acuity cancellation webhook processes the refund; events are refunded by the holiday program refund code because they share its checkout, and their cancellation email uses the Acuity appointment type name (e.g. "Halloween Spookfest"). Acuity's client reschedule cutoff must be no stricter than 48 hours, and client rescheduling should be off for the event appointment type.

Policy copy and the cutoff live in `packages/core/src/program-bookings/booking-policy.ts`. The website policies page, booking forms, emails and this page all render it.

After a change the page shows only a confirmation, with no further options. Programs that allow rescheduling send the same short `programSessionRescheduled` email, showing the previous and new session.
