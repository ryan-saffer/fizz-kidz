# Party checkout

Collecting payment for a studio party at the studio, once it's over: staff confirm the party on the portal's iPad and the charge goes to the studio's Square Terminal. The portal side is in `apps/portal/src/features/bookings/parties/checkout`. Input schemas and the booking's `payment` record are in `packages/core/src/parties/party-checkout.ts`; the Square price list is `packages/core/src/square/square-party-price.ts`.

Tests live in a `__tests__` folder next to the files they cover.

## What's charged

A party is charged the price per child for its length (1.5 or 2 hours) with or without the food package, for the children who came but at least `MIN_CHARGED_CHILDREN` (12), plus one of each food addition. Party packs, cakes and take-home goodies are paid for in advance in the party form, so they aren't charged here.

Every price comes from Square. `PARTY_PRICE_SQUARE_CATALOG` maps each length and food package to a Square variation, one price list for current prices and one for bookings flagged `oldPrices`. Food additions are the party form's (`getPartyFormV2Additions`), ordered by their Square variation. Names shown to staff and parents drop Square's staff tags such as `[NO FOOD]` (`withoutSquareTags`).

Staff can add a discount (a dollar amount off the whole order, up to all of it) and a Square gift card. Both are optional. A discount needs a reason, kept in the order's metadata and the booking's `payment` record; Square and the customer's receipt just show 'Discount'.

## How a charge flows

1. **`get-party-checkout.ts`** loads what the checkout offers for a booking: the four party prices at the studio, the additions, and prefilled answers (the booking's length, food package, additions, and the lower end of its number of children). `blocked` explains why a booking can't be charged: it's paid, it's a mobile party, its studio isn't trialling checkout yet (`TERMINAL_CHECKOUT_TRIAL_STUDIOS`, prod only), or its price isn't sold at the studio in Square (today's old prices, see below).
2. **`prepare-party-checkout.ts`** builds the Square line items from the booking and the confirmed answers (never browser amounts) and calls the shared `prepareCheckout` (`features/payments`), which prices them in Square, applies the discount and gift card, and creates the unpaid order. The order's metadata holds the booking id and the number of children charged.
3. **`charge-party-checkout.ts`** sends that order to the terminal (`startTerminalPayment`, skipping the terminal's receipt screen since the parent is emailed our own) and reports where it's up to (`getTerminalPayment`), which the portal checks every couple of seconds. Staff can cancel (`cancelTerminalPayment`).
4. Once paid, the payment is recorded on the booking (`payment`: order id, totals, gift card, discount and its reason, children charged, receipt) and **`send-party-payment-receipt.ts`** emails the parent an itemised receipt with Square's receipt link. Square doesn't email receipts for Terminal API payments. **`sync-party-payment-to-zoho.ts`** sets the party's Zoho deal `Amount` to the total paid and adds a 'Party payment' note to the deal with the breakdown, receipt and Square order. `DatabaseClient.recordPartyPayment` records it in a transaction on the booking, so it's recorded, emailed and added to Zoho once however many times it's checked; a failed email or Zoho update is logged and doesn't fail the payment.
5. The shared terminal checkout webhook (`features/payments`, see its README) does the same as soon as Square says a party's terminal checkout has finished, so a payment is recorded even if the iPad closed the checkout or lost its connection. It settles the charge with `getPartyCheckoutStatus`, just as the iPad does.

A cancelled or timed-out charge takes nothing. Sending it again prepares a new order.

## Terminals

Each studio's terminal, pairing it, and Square's sandbox test devices are shared with product sales; see `features/payments/README.md`. Successful sandbox payments must be at most US$25, so the sandbox party items are priced in cents.

## Known limits

- The old prices are variations on the 'Studio Party - TEST' item, which isn't sold at any studio in Square, so old-price parties show as blocked until they are.
