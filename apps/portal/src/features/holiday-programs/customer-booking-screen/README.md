# Holiday Program Booking

The customer picks sessions, adds children, applies a discount or gift card, pays, and receives a confirmation with Portal management links.

## Who Owns What

- **Acuity:** sessions, prices, availability, and attendance
- **Firestore:** discount codes and redemptions
- **Square:** orders, gift cards, payments, and refunds
- **Zoho:** customer and deal follow-up

The Portal owns the form and cart. `apps/server/src/features/holiday-programs/core` owns validation, payment, scheduling, and side effects.

## Checkout In One Breath

The server validates the amount, claims an idempotency key, rechecks Acuity capacity, creates and pays a Square order, books paid Acuity appointments, then updates Zoho, sends email, records discounts, and tracks analytics.

Payment supports Apple Pay, Google Pay, card, Square gift card, split gift-card/card payments, and zero-dollar orders.

> **All-day is not a discount.** Selecting two sessions on one day marks both appointments with Acuity's `allday` certificate, but does not reduce the price. Firestore discount codes are the only automatic cart discount.

> **Payment happens first.** If Acuity scheduling fails after Square succeeds, there is no automatic compensation. Use the logged order ID to reconcile it manually.

## Open Days and Anniversaries

Werribee Open Day and **Malvern's 10th Birthday Party!** share `AcuityConstants.AppointmentTypes.OPEN_DAY` (`75381458`). The appointment's `calendarID` selects the confirmation email and canonical studio address: Werribee uses `14046878`, and Malvern uses `3163508`. Dates and times come from the booked appointments. The selected studio determines the Square location for checkout.

## Medical plans

Each child answers the asthma action plan question independently of allergies. Anaphylactic children must upload an anaphylaxis plan; children who require an asthma action plan must upload that plan too. Each upload must be a PDF smaller than 5MB, and checkout validates the required files before taking payment.

Both plans use the existing `anaphylaxisPlans/` Storage namespace. Asthma files have the `holiday-program-asthma-` prefix. The server writes both plan references and their requirement markers into Acuity's existing allergies field. The shared contract in `packages/core/src/holiday-programs/medical-plans.ts` formats and parses this field, including older anaphylaxis URLs.

Attendance shows separate anaphylaxis and asthma indicators and plan buttons. Sign-in requires staff to open and verify each required plan. Authenticated plan endpoints use the shared signer in `apps/server/src/features/medical-plans` to refresh read URLs.

## Cancellations and rescheduling

Confirmation emails link each appointment to `/programs/manage/:appointmentId#token=...`, a public page for rescheduling or cancelling one child's session. The token is an HMAC of the appointment ID signed with `ACUITY_API_KEY`.

Rescheduling moves the appointment to another session at the same studio, at least 48 hours before the current session. Cancelling is allowed until the session starts, and the Acuity webhook handles the refund. Acuity's client reschedule cutoff must be no stricter than 48 hours.

Policy copy and the cutoff live in `packages/core/src/holiday-programs/booking-policy.ts`.

The Acuity webhook finds the exact Square line item using the stored order ID and line-item identifier.

- At least 48 hours out: refund the charged amount across the available tenders.
- Inside 48 hours: no automatic refund.
- Free line item: no Square refund.
- Either way: send the cancellation email.

All-day status is not recalculated when one appointment is cancelled or when the second session is booked later.
