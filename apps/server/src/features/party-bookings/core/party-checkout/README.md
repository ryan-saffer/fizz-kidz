# Party checkout

Collecting payment for a studio party at the studio, once it's over: staff confirm the party on the portal's iPad and the charge goes to the studio's Square Terminal. The portal side is in `apps/portal/src/features/bookings/parties/checkout`. Input schemas and the booking's `payment` record are in `packages/core/src/parties/party-checkout.ts`; the Square price list is `packages/core/src/square/square-party-price.ts`.

Tests live in a `__tests__` folder next to the files they cover.

## What's charged

A party is charged the price per child for its length (1.5 or 2 hours) with or without the food package, for the children who came but at least `MIN_CHARGED_CHILDREN` (12), plus one of each food addition. Party packs, cakes and take-home goodies are paid for in advance in the party form, so they aren't charged here.

Every price comes from Square. `PARTY_PRICE_SQUARE_CATALOG` maps each length and food package to a Square variation, one price list for current prices and one for bookings flagged `oldPrices`. Food additions are the party form's (`getPartyFormV2Additions`), ordered by their Square variation. Names shown to staff and parents drop Square's staff tags such as `[NO FOOD]` (`withoutSquareTags`).

Staff can add a discount (a dollar amount off the whole order, up to all of it) and a Square gift card. Both are optional. A discount needs a reason, kept in the order's metadata and the booking's `payment` record; Square and the customer's receipt just show 'Discount'.

## How a charge flows

1. **`get-party-checkout.ts`** loads what the checkout offers for a booking: the four party prices at the studio, the additions, and prefilled answers (the booking's length, food package, additions, and the lower end of its number of children). `blocked` explains why a booking can't be charged: it's paid, it's a mobile party, its studio isn't trialling checkout yet (`PARTY_CHECKOUT_TRIAL_STUDIOS`, prod only), or its price isn't sold at the studio in Square (today's old prices, see below).
2. **`prepare-party-checkout.ts`** builds the Square line items from the booking and the confirmed answers (never browser amounts) and calls the shared `prepareCheckout` (`features/payments`), which prices them in Square, applies the discount and gift card, and creates the unpaid order. The order's metadata holds the booking id and the number of children charged.
3. **`charge-party-checkout.ts`** sends that order to the terminal (`startTerminalPayment`) and reports where it's up to (`getTerminalPayment`), which the portal checks every couple of seconds. Staff can cancel (`cancelTerminalPayment`).
4. Once paid, the payment is recorded on the booking (`payment`: order id, totals, gift card, discount and its reason, children charged, receipt) and **`send-party-payment-receipt.ts`** emails the parent an itemised receipt with Square's receipt link. Square doesn't email receipts for Terminal API payments. **`sync-party-payment-to-zoho.ts`** sets the party's Zoho deal `Amount` to the total paid and adds a 'Party payment' note to the deal with the breakdown, receipt and Square order. `DatabaseClient.recordPartyPayment` records it in a transaction on the booking, so it's recorded, emailed and added to Zoho once however many times it's checked; a failed email or Zoho update is logged and doesn't fail the payment.
5. **`handle-party-checkout-webhook.ts`** does the same as soon as Square says a terminal checkout has finished, so a payment is recorded even if the iPad closed the checkout or lost its connection. It checks Square's signature, then settles the charge with `getPartyCheckoutStatus`, just as the iPad does. The route is `POST /api/webhooks/party-checkout`.

A cancelled or timed-out charge takes nothing. Sending it again prepares a new order.

## Terminals

Each studio has one terminal: the one paired with the portal at its Square location (`party-terminals.ts`, using `features/payments/core/terminals.ts`), which the portal uses automatically. Pairing creates a Square device code that staff enter on the terminal's sign-in screen. A paired terminal runs in Square's Terminal API mode rather than the Square Point of Sale app until it's signed out. Signing out doesn't remove the pairing, and the API can't delete one: a paired terminal is only removed by deleting it in the Square Dashboard's Devices section. Pairing the same terminal again leaves two paired codes for it, so the list skips duplicates.

Square's sandbox can't pair real terminals, so in dev the list is Square's test devices (succeeds, customer cancels, times out, offline). Successful sandbox payments must be at most US$25, so the sandbox party items are priced in cents.

## Known limits

- The old prices are variations on the 'Studio Party - TEST' item, which isn't sold at any studio in Square, so old-price parties show as blocked until they are.

## Setting up the webhook

Each Square application (sandbox for dev, production for prod) needs a webhook subscription:

1. In the [Square Developer Dashboard](https://developer.squareup.com/apps), open the application, then **Webhooks → Subscriptions → Add subscription**.
2. Notification URL: `https://dev.fizzkidz.com.au/api/webhooks/party-checkout` (sandbox) or `https://bookings.fizzkidz.com.au/api/webhooks/party-checkout` (production). It must match exactly, because Square signs it (`PARTY_CHECKOUT_WEBHOOK_URL`).
3. Event: `terminal.checkout.updated`.
4. Copy the subscription's signature key into `SQUARE_WEBHOOK_SIGNATURE_KEY` in the server's env file for that environment (and the `SERVER_ENV_FILE` GitHub variable).

Until the key is set the webhook refuses every event (and logs it), and payments are recorded by the iPad as before.
