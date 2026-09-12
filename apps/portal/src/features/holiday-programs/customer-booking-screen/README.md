# Holiday Program Booking

The customer picks sessions, adds children, applies a discount or gift card, pays, and lands in Acuity.

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

Werribee Open Day and Malvern's 10th anniversary event, **Malvern Turns 10!**, share `AcuityConstants.AppointmentTypes.OPEN_DAY` (`75381458`). The appointment's `calendarID` selects the confirmation email and canonical studio address: Werribee uses `14046878`, and Malvern uses `3163508`. Dates and times come from the booked appointments. The selected studio determines the Square location for checkout.

## Cancellations

The Acuity webhook finds the exact Square line item using the stored order ID and line-item identifier.

- At least 48 hours out: refund the charged amount across the available tenders.
- Inside 48 hours: no automatic refund.
- Free line item: no Square refund.
- Either way: send the cancellation email.

All-day status is not recalculated when one appointment is cancelled or when the second session is booked later.
