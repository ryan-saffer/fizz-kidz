# Custom party form checkout

The public tRPC procedures are `parties.getPartyFormV2Config`, `parties.preparePartyFormV2` and `parties.submitPartyFormV2`. Runtime input schemas live in `packages/core/src/parties/party-form-v2.ts`.

## Prepare

`prepare-party-form-v2.ts` validates the booking's channel, creation count and current Sanity availability before creating an unpaid Square order. Paid items are cake, serving/candle modifiers, take-home bags and kits. Food is invoiced with the party. Square's catalogue and automatic pricing rules determine the subtotal. Discount codes are checked against the booking's stored customer email and applied before gift cards.

`partyFormV2Submissions` stores the answers and an immutable payment summary, order ID, gift-card ID, discount identity and preparation timestamp. It never stores a card token, verification token or gift-card number. Preparation does not capture money or mark the party form complete.

## Pay and complete

`submit-party-form-v2.ts` claims a two-minute payment lease. It reserves discount usage transactionally, respecting expiry, allocated uses and one-use-per-customer limits. A separate persisted validation milestone gates tender creation, so a stopped process resumes unfinished validation rather than bypassing it. Definite failures release the reservation; successful payments convert it to an idempotent `discountCodeRedemptions` record with booking type `party-form-v2`.

`pay-party-form-v2-order.ts` follows preschool-v2's Square tender sequence: authorise the gift-card contribution, authorise the card remainder, then pay the order with those payment IDs. A zero-total order is paid with no tenders. The checkout ID supplies stable idempotency keys. Card declines cancel the gift-card authorisation. Ambiguous provider failures preserve the original payment amounts and idempotency keys for replay; a completed Square order is reconciled without another charge.

Only paid submissions enter `process-party-form-v2.ts`. The existing party-form mapper and notification workflow consume the stored answers. Square inventory reversals use a stable key and timestamp. The booking write and `bookingApplied` marker are atomic, so retries cannot add purchased quantities twice. Failed or stale processing claims can be retried. An original-booking snapshot preserves the old quantities used in supplier emails. Paid supplier notifications and the customer confirmation each have a sent marker; retries skip completed sends and resume unfinished ones, even after the booking was written. These notification failures propagate to the processing state and remain in server logs rather than marking the order complete prematurely.

The response distinguishes completed submissions from processing payments. A browser redirect cannot mark an unpaid submission complete. The former `/api/party-form-v2/form-complete` route has been removed.
