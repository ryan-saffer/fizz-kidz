# Program Booking Management

Holiday program and Preschool Program confirmation emails link each appointment to `/programs/manage/:appointmentId#token=...`. This public page lets a parent reschedule or cancel one child's session. The token is an HMAC of the appointment ID signed with `ACUITY_API_KEY`, and stays in the URL fragment.

The server (`apps/server/src/features/program-bookings`) reads the program from the Acuity appointment type and applies its rules:

|                   | Holiday program                      | Preschool Program                                                 |
| ----------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Reschedule to     | Any later session at the same studio | Any later session at the same studio in the same term, on any day |
| Refund preview    | Amount paid for the session          | Repriced order, flags when the full-term discount is lost         |
| Rescheduled email | Holiday program confirmation         | Preschool Program confirmation                                    |

Both programs share a 48-hour cutoff for rescheduling and refunds; cancelling stays open until the session starts. The Acuity cancellation webhook processes the refund. Acuity's client reschedule cutoff must be no stricter than 48 hours.

Policy copy and the cutoff live in `packages/core/src/program-bookings/booking-policy.ts`. The website policies page, booking forms, emails and this page all render it.
