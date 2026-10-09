# Payments

The shared server-side payment module for booking flows that take payments through Square. It owns the money: pricing in Square, discount codes, gift cards, card and wallet payments, and replays. Booking flows own everything else: what is being bought, their own UI, and what happens once payment succeeds.

Currently used by the custom party form, the party checkout (charging a party on a Square Terminal) and product sales (selling our kits on a Square Terminal). Preschool v2 and holiday programs are to move onto it.

Tests live in a `__tests__` folder next to the file they cover (e.g. `core/__tests__/pay-checkout.test.ts` tests `core/pay-checkout.ts`). This is being tried here and in the party form before the rest of the repo.

## Using it

1. **Price the items on the server.** Build Square line items from the catalogue, or from names and amounts the booking flow looked up itself (e.g. Acuity class prices), plus any line-item discounts it priced itself. Never use amounts sent by the browser.
2. **`prepareCheckout`** (`core/prepare-checkout.ts`) prices them in Square (including automatic discounts), applies the discount code and then the gift card, and creates an unpaid Square order. It returns a `CheckoutSummary` (from `@fizz-kidz/core`) to show the customer: the breakdown, discount, gift-card share and amount left for the card. `checkoutId` is the Square order id. Booking metadata passed here (at most three entries) is kept on the order.
3. **`payCheckout`** (`core/pay-checkout.ts`) takes the card or wallet token and pays the order. Pass the same booking metadata to make sure the order is the one prepared for this booking:
   - `paid` — Square has the money. Carry on with the booking. Calling again returns `paid` without charging.
   - `processing` — Square's response was lost or unclear. Call again with the same input.
   - Definite failures throw tRPC errors (`PAYMENT_METHOD_INVALID`, `GIFT_CARD_INACTIVE`, `BAD_REQUEST` asking the customer to refresh the payment summary). The customer then prepares a new checkout.
4. **Do the booking work after `paid`**, idempotently, since a replay can reach it again.

A walk-in sale (product sales) leaves out `customer`: the order has no Square customer, and it can't take a discount code, since a code's limits are per customer.

A booking flow can also pass `orderDiscount` to `prepareCheckout`: a discount it decided itself (e.g. staff making up for a problem), taken off the whole order after the discount code and shown as `orderDiscountCents`. Paying with `payCheckout` re-checks only the discount code, so don't combine the two there.

## On a Square Terminal

In person, the card is taken on a Square Terminal instead of with a token (`core/terminal-payment.ts`):

- **`startTerminalPayment`** authorises the gift-card share, then sends the rest of a prepared order to a terminal with `autocomplete: false`, so nothing is captured until the order is paid. A gift card covering everything pays straight away. `receiptScreen` says whether the terminal offers the customer a receipt (email, text or printed) once they've paid: product sales do; party checkout emails its own. `referenceId` is kept on the terminal checkout, e.g. the booking id.
- **`getTerminalPayment`** reports `waiting`, `paid` or `canceled` (with the reason: the customer cancelled, staff cancelled, or the terminal timed out). Once the terminal payment completes, it pays the order with it and the gift-card share, capturing both. A cancelled charge releases the gift-card share; a terminal payment that completes after being cancelled is never captured, and Square cancels it. Safe to call repeatedly.
- **`cancelTerminalPayment`** asks the terminal to cancel. A customer who already paid still completes.

Square keys (`<order id>-gift`, `-terminal`, `-pay`) make each step happen once per order, so sending a cancelled charge again means preparing a new checkout. Orders use Square catalogue items, so paying one updates the items' stock in Square.

The portal's shared terminal checkout (`apps/portal/src/features/terminal-checkout`) drives these for every booking flow.

### Terminals

Each studio has one terminal: the one paired with the portal at its Square location, which the portal uses automatically. `core/terminals.ts` lists them and pairs new ones (`listStudioTerminals`, `pairStudioTerminal`, named after the studio, e.g. 'Cheltenham Terminal'), served by the `payments` tRPC router (`functions/trpc/payments.trpc.ts`). Pairing creates a Square device code that staff enter on the terminal's sign-in screen. A paired terminal runs in Square's Terminal API mode rather than the Square Point of Sale app until it's signed out. Signing out doesn't remove the pairing, and the API can't delete one: a paired terminal is only removed by deleting it in the Square Dashboard's Devices section. Pairing the same terminal again leaves two paired codes for it, so the list skips duplicates.

Square's sandbox can't pair real terminals, so in dev the list is Square's test devices (succeeds, customer cancels, times out, offline). Successful sandbox payments must be at most US$25, so the sandbox items charged on a terminal are priced in cents.

Terminal checkout is rolled out studio by studio: prod only offers it at the studios in `TERMINAL_CHECKOUT_TRIAL_STUDIOS` (`packages/core`), which covers both party checkout and product sales. Super-admins have it at every studio, to try it before a studio does (`core/terminal-checkout-access.ts` checks their role), and dev offers it everywhere.

### The webhook

`core/handle-terminal-checkout-webhook.ts` settles a terminal checkout as soon as Square says it has finished, so a payment completes (and a party is recorded) even if the iPad closed the checkout or lost its connection. It checks Square's signature, reads the order's `program`, and hands the checkout to that booking flow's settler, registered in `apps/server/src/app/http/terminal-checkout.webhook.ts`: the same status check its iPad makes. Charges that aren't our checkouts are ignored.

The route is `POST /api/webhooks/party-checkout`, the URL the Square subscriptions were set up with when only parties used the terminal. Each Square application (sandbox for dev, production for prod) needs a subscription:

1. In the [Square Developer Dashboard](https://developer.squareup.com/apps), open the application, then **Webhooks → Subscriptions → Add subscription**.
2. Notification URL: `https://dev.fizzkidz.com.au/api/webhooks/party-checkout` (sandbox) or `https://bookings.fizzkidz.com.au/api/webhooks/party-checkout` (production). It must match exactly, because Square signs it (`TERMINAL_CHECKOUT_WEBHOOK_URL`).
3. Event: `terminal.checkout.updated`.
4. Copy the subscription's signature key into `SQUARE_WEBHOOK_SIGNATURE_KEY` in the server's env file for that environment (and the `SERVER_ENV_FILE` GitHub variable).

Until the key is set the webhook refuses every event (and logs it), and payments are settled by the iPad as before.

## How it works

There is no database record of a checkout. The unpaid Square order is the checkout: it holds the priced items and the discount code's order discount, and its metadata holds the program, customer, discount code and gift-card share (`core/checkout-order.ts`). Square allows ten metadata entries; checkouts use up to seven and leave three for the booking flow (e.g. its booking id); Square rejects more.

`core/take-checkout-payment.ts` authorises the gift-card share and the card or wallet for the rest (both with `autocomplete: false`), then pays the order with both, so the customer is charged all at once or not at all. A 4xx from Square is a definite failure (nothing was charged): any authorisation so far is released and the customer prepares a new checkout. Only transport failures and 5xx responses are unclear and return `processing`. Every Square call uses an idempotency key derived from the order id, so a replay returns the original payments instead of charging again. Wallet payments need no buyer verification token.

Before charging, `payCheckout` re-checks the discount code (expired, used up, already redeemed by this customer, or changed amount). Once the order is paid it records the use in `discountCodeRedemptions` (keyed by order id, so a replay finds it and doesn't count it twice) and increments the code's use count. A fixed-amount code larger than the order covers all of it.

## Known trade-offs

- A code's use is only counted once payment succeeds, so two customers paying with a code's last use at the same moment could both succeed.
- Uncaptured authorisations from a payment abandoned mid-way (e.g. the customer never replays after `processing`) are left for Square to expire.
