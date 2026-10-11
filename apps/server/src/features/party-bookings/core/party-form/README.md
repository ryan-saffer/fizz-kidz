# Party form

The server side of the party form, which parents fill in before their party, and its cake form. Its tRPC procedures are `parties.getPartyFormConfig`, `parties.preparePartyForm` and `parties.submitPartyForm`; input schemas live in `packages/core/src/parties/party-form.ts`. The portal side is `apps/portal/src/features/party-form`.

Tests live in a `__tests__` folder next to the file they cover (e.g. `checkout/__tests__/prepare-party-form.test.ts` tests `checkout/prepare-party-form.ts`). This is being tried here, in the portal party form and in payments before the rest of the repo.

## Links

We send `/forms/party?id=<bookingId>` (the party form) and `/forms/cake?id=<bookingId>` (the cake form), in emails and from the portal's copy-link buttons; `party-form-urls.ts` builds them. Firebase hosting sends `/forms/**` to the server, where `functions/routes/party-form-links.ts` redirects them to the form in the portal (`/party-form?id=…`, with `&mode=cake` for cake links) when clicked. The links stay short and stable, and where they lead can change without breaking links already sent. Other `/forms/…` links are our remaining Paperforms (`integrations/paperforms`).

## How a submission flows

1. **`config/`**: `get-party-form-config.ts` loads what the form shows for a booking: prefill, earlier orders, creations (Sanity) and the Square-driven options. A booking that no longer exists returns `NOT_FOUND`.
2. **`options/`**: what parents can choose, read live from Square for the booking's studio: food additions, the ice-cream cake, and take-home goodies.
3. **`checkout/`**: `validate-party-form.ts` checks the answers and builds the Square line items; `prepare-party-form.ts` prepares a checkout for them, and `submit-party-form.ts` pays it and hands over to booking. Payments go through the shared module in `features/payments`.
4. **`booking/`**: `process-party-form.ts` saves the submission and applies it to the party booking with `apply-party-form.ts`.

## Party form and cake form

The same form runs in two modes, set by the link. `party` is the full party details form. `cake` (`?mode=cake`, the cake form) only orders a cake and take-home goodies, and is sent from booking time, so parents can order months ahead.

The mode is decided in a few places only: the portal's step list and some wording, the payload schema (a union: the cake form carries just the order), validation (party questions are only checked in party mode), and applying it to the booking: the cake form only sets the cake and goodies, doesn't mark the party form filled in, and sends the cake form confirmation (only if something was ordered) instead of the party form one.

Earlier orders carry over between forms. One cake per party: once the booking has a cake, the form shows it read-only and validation rejects another. Take-home bags and kits can be added to at any time; each card shows how many were already ordered, and new quantities are added on top.

Cakes are only offered where `canOrderCake` allows (studio parties, not Geelong or Werribee), in either mode.

## Options

**Food additions** (`options/get-party-form-additions.ts`) are the items in Square's 'Additional Options' category sold at the studio, in Dashboard order, with name, description, photo and price. Bookings store additions as boolean keys (inventory rules, shopping lists, the booking editor and emails rely on them), so `square-party-additions.ts` in `@fizz-kidz/core` maps each Square item to its key. An unmapped item is hidden with a warning log.

**Ice-cream cake** (`options/get-party-form-cake-options.ts`) is built entirely from the Square cake item: sizes are its variations; designs, flavours, serving and candles are its modifier lists (designs and flavours at $0). Names, order, photos, studio prices, sold out or not sold at the studio, and the flavour limits all come from Square; IDs are in `square-party-cake.ts`. Only "I will bring my own cake" is fixed in the form.

**Take-home goodies** (`options/get-party-form-take-home-options.ts`): bags are the variations of the take-home bag item and kits are the items in the Products category. We don't use Square Online, so an item's 'Fizz Kidz Store' sales channel (the Dashboard's online store toggle) decides whether the form offers it; the sandbox has no online store, so dev skips that check. 'Not sold at this location' hides an item at one studio. Stock counts are ignored: goodies are ordered from the supplier per party, so Square's automatic sold-out would hide them for no reason. Each is priced by asking Square to calculate an order of 12, so bulk pricing rules are included. Bags and kits are sold in lots of at least `MIN_TAKE_HOME_QUANTITY` (12); once an item is ordered, parents can top it up by any amount (e.g. late RSVPs). Square's kit bulk price ('Products Bulk Discount') needs 12 kits in one order, so a smaller kit top-up is discounted down to the bulk price the form showed. `square-party-take-home.ts` maps each booking key to its Square variation.

If Square can't be reached, the form still loads: without additions, take-home goodies or the cake step.

## Checkout

`checkout/validate-party-form.ts` checks the answers against the booking (party questions, creation count, creations Sanity offers for the party, one cake, cake studios, take-home minimums) and builds the paid line items: the cake (size variation plus serving, candle, design and flavour modifiers) and take-home bags and kits. Other choices Square no longer offers fail when Square prices the order. Food is charged at the end of the party, so it isn't part of the checkout.

`checkout/prepare-party-form.ts` calls `prepareCheckout` when anything is payable, which creates the unpaid Square order with the discount code and gift card applied. Nothing is saved yet: the order's metadata holds the booking id and a hash of the answers, and the browser keeps the answers.

`checkout/submit-party-form.ts` receives the answers again with the checkout id and card token. `payCheckout` only pays an order whose metadata matches those answers, so a checkout can't pay for different ones. Payment is safe to replay: an unclear Square response returns `processing`, and a replay either finds the order paid or retries the same payment. If the answers fail to apply after payment, the response is also `processing`, and a replay retries only the booking update. With nothing to pay, submit validates the answers itself and errors go straight to the customer.

## Booking

`booking/process-party-form.ts` saves the submission to `partyFormSubmissions` (under the Square order id when paid), so every submission can be checked against its booking. Square inventory for goodies is put back, since they're ordered through the supplier. It then applies the submission with `booking/apply-party-form.ts`, and marks it `bookingApplied` so a replay doesn't apply it twice.

`booking/apply-party-form.ts` writes the answers to the booking (`get-party-form-booking-update.ts` maps them to booking fields; new take-home quantities are added to earlier ones), then sends the emails: the parent's party form or cake form confirmation, the studio's notes (form filled in again, food package changed, questions asked, take-home items ordered) and the supplier's cake and take-home bag orders. It also records the Mixpanel event. Only the booking write can fail the submission; emails and analytics are logged and skipped.
