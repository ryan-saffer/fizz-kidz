# Payments

The shared server-side payment module for booking flows that take payments through Square. It owns the money: pricing in Square, discount codes, gift cards, card and wallet payments, and replays. Booking flows own everything else: what is being bought, their own UI, and what happens once payment succeeds.

Currently used by the custom party form. Preschool v2 and holiday programs are to move onto it; Play Lab is deprecated.

Tests live in a `__tests__` folder next to the file they cover (e.g. `core/__tests__/pay-checkout.test.ts` tests `core/pay-checkout.ts`). This is being tried here and in the party form before the rest of the repo.

## Using it

1. **Price the items on the server.** Build Square line items from the catalogue, or from names and amounts the booking flow looked up itself (e.g. Acuity class prices), plus any line-item discounts it priced itself. Never use amounts sent by the browser.
2. **`prepareCheckout`** (`core/prepare-checkout.ts`) prices them in Square (including automatic discounts), applies the discount code and then the gift card, and creates an unpaid Square order. It returns a `CheckoutSummary` (from `@fizz-kidz/core`) to show the customer: the breakdown, discount, gift-card share and amount left for the card. `checkoutId` is the Square order id. Booking metadata passed here (at most three entries) is kept on the order.
3. **`payCheckout`** (`core/pay-checkout.ts`) takes the card or wallet token and pays the order. Pass the same booking metadata to make sure the order is the one prepared for this booking:
   - `paid` — Square has the money. Carry on with the booking. Calling again returns `paid` without charging.
   - `processing` — Square's response was lost or unclear. Call again with the same input.
   - Definite failures throw tRPC errors (`PAYMENT_METHOD_INVALID`, `GIFT_CARD_INACTIVE`, `BAD_REQUEST` asking the customer to refresh the payment summary). The customer then prepares a new checkout.
4. **Do the booking work after `paid`**, idempotently, since a replay can reach it again.

## How it works

There is no database record of a checkout. The unpaid Square order is the checkout: it holds the priced items and the discount code's order discount, and its metadata holds the program, customer, discount code and gift-card share (`core/checkout-order.ts`). Square allows ten metadata entries; checkouts use up to seven and leave three for the booking flow (e.g. its booking id); Square rejects more.

`core/take-checkout-payment.ts` authorises the gift-card share and the card or wallet for the rest (both with `autocomplete: false`), then pays the order with both, so the customer is charged all at once or not at all. A 4xx from Square is a definite failure (nothing was charged): any authorisation so far is released and the customer prepares a new checkout. Only transport failures and 5xx responses are unclear and return `processing`. Every Square call uses an idempotency key derived from the order id, so a replay returns the original payments instead of charging again. Wallet payments need no buyer verification token.

Before charging, `payCheckout` re-checks the discount code (expired, used up, already redeemed by this customer, or changed amount). Once the order is paid it records the use in `discountCodeRedemptions` (keyed by order id, so a replay finds it and doesn't count it twice) and increments the code's use count. A fixed-amount code larger than the order covers all of it.

## Known trade-offs

- A code's use is only counted once payment succeeds, so two customers paying with a code's last use at the same moment could both succeed.
- Uncaptured authorisations from a payment abandoned mid-way (e.g. the customer never replays after `processing`) are left for Square to expire.
