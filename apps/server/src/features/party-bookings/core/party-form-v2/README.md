# Custom party form

The server side of `/party-form-v2`, the replacement for the hosted Paperform party form. Its tRPC procedures are `parties.getPartyFormV2Config`, `parties.preparePartyFormV2` and `parties.submitPartyFormV2`; input schemas live in `packages/core/src/parties/party-form-v2.ts`.

Tests live in a `__tests__` folder next to the file they cover (e.g. `checkout/__tests__/prepare-party-form-v2.test.ts` tests `checkout/prepare-party-form-v2.ts`). This is being tried here, in the portal party form and in payments before the rest of the repo.

## How a submission flows

1. **`config/`**: `get-party-form-v2-config.ts` loads what the form shows for a booking: prefill, earlier orders, creations (Sanity) and the Square-driven options. A booking that no longer exists returns `NOT_FOUND`.
2. **`options/`**: what parents can choose, read live from Square for the booking's studio: food additions, the ice-cream cake, and take-home goodies.
3. **`checkout/`**: `validate-party-form-v2.ts` checks the answers and builds the Square line items; `prepare-party-form-v2.ts` prepares a checkout for them, and `submit-party-form-v2.ts` pays it and hands over to booking. Payments go through the shared module in `features/payments`.
4. **`booking/`**: `process-party-form-v2.ts` saves the submission and applies it to the party booking, reusing the Paperform pipeline.

`build-party-form-v2-submission.ts` turns answers into a synthetic Paperform submission; checkout uses it to check the pipeline accepts them, and booking to apply them.

## Party form and cake form

The same form runs in two modes, set by the link. `party` is the full party details form. `cake` (`?mode=cake`, the Paperform's 'cake form') only orders a cake and take-home goodies, and is sent from booking time, so parents can order months ahead.

The mode is decided in four places only: the portal's step list and some wording, the payload schema (a union: the cake form carries just the order), validation (party questions are only checked in party mode), and the synthetic submission's `party_or_cake_form`. From there the existing pipeline behaves exactly as it does for the Paperform cake form: it doesn't mark the party form filled in, and sends the cake form confirmation (only if something was ordered) instead of the party form one. The cake form repeats the booking's own details, as the Paperform's prefill did, and leaves unanswered party questions out so the booking keeps them.

Earlier orders carry over between forms. One cake per party: once the booking has a cake, the form shows it read-only and validation rejects another. Take-home bags and kits can be added to at any time; each card shows how many were already ordered, and new quantities are added on top.

Cakes are only offered where `canOrderCake` allows (studio parties, not Geelong or Werribee), in either mode.

## Options

**Food additions** (`options/get-party-form-v2-additions.ts`) are the items in Square's 'Additional Options' category sold at the studio, in Dashboard order, with name, description, photo and price. Bookings still store additions as boolean keys (inventory rules, shopping lists, the booking editor and emails rely on them), so `square-party-additions.ts` in `@fizz-kidz/core` maps each Square item to its key. An unmapped item is hidden with a warning log.

**Ice-cream cake** (`options/get-party-form-v2-cake-options.ts`) is built entirely from the Square cake item: sizes are its variations; designs, flavours, serving and candles are its modifier lists (designs and flavours at $0). Names, order, photos, studio prices, sold-out-at-studio and the flavour limits all come from Square; IDs are in `square-party-cake.ts`. Only "I will bring my own cake" is fixed in the form.

**Take-home goodies** (`options/get-party-form-v2-take-home-options.ts`): bags are the variations of the take-home bag item and kits are the items in the Products category. We don't use Square Online, so an item's 'Fizz Kidz Store' sales channel (the Dashboard's online store toggle) decides whether the form offers it; the sandbox has no online store, so dev skips that check. 'Not sold at this location' hides an item at one studio. Stock counts are ignored: goodies are ordered from the supplier per party, so Square's automatic sold-out would hide them for no reason. Each is priced by asking Square to calculate an order of 12, so bulk pricing rules are included. Bags and kits are sold in lots of at least `MIN_TAKE_HOME_QUANTITY` (12), matching the Paperform; once an item is ordered, parents can top it up by any amount (e.g. late RSVPs). Square's kit bulk price ('Products Bulk Discount') needs 12 kits in one order, so a smaller kit top-up is discounted down to the bulk price the form showed. `square-party-take-home.ts` maps each booking key to its Square variation, and the Paperform checkout uses the same table.

If Square can't be reached, the form still loads: without additions, take-home goodies or the cake step.

## Checkout

`checkout/validate-party-form-v2.ts` checks the answers against the booking (party questions, creation count, one cake, cake studios, take-home minimums), checks the Paperform pipeline accepts them (which rejects creations Sanity no longer offers for the party), and builds the paid line items: the cake (size variation plus serving, candle, design and flavour modifiers) and take-home bags and kits. Other choices Square no longer offers fail when Square prices the order. Food is charged at the end of the party, so it isn't part of the checkout.

`checkout/prepare-party-form-v2.ts` calls `prepareCheckout` when anything is payable, which creates the unpaid Square order with the discount code and gift card applied. Nothing is saved yet: the order's metadata holds the booking id and a hash of the answers, and the browser keeps the answers.

`checkout/submit-party-form-v2.ts` receives the answers again with the checkout id and card token. `payCheckout` only pays an order whose metadata matches those answers, so a checkout can't pay for different ones. Payment is safe to replay: an unclear Square response returns `processing`, and a replay either finds the order paid or retries the same payment. If the answers fail to apply after payment, the response is also `processing`, and a replay retries only the booking update. With nothing to pay, submit validates the answers itself and errors go straight to the customer.

## Booking

`booking/process-party-form-v2.ts` saves the submission to `partyFormSubmissions` (under the Square order id when paid), so every submission can be checked against its booking, as with Paperform's submissions list. It then turns the answers into the synthetic Paperform submission, so the existing `PartyFormMapper` and `handlePartyFormSubmission` workflow (booking update, emails, Mixpanel, supplier notifications) run unchanged. Cake answers are Square option names the Paperform fields can't hold, so the cake is passed to the booking directly. Square inventory for goodies is put back, since they're ordered through the supplier. Once applied, the submission is marked `bookingApplied`, so a replay doesn't apply it twice. Emails and inventory are best effort (logged, never failing the submission).

Persisted names (the `partyFormSubmissions` collection, the `party-form` discount redemption type and the order metadata keys) have no "v2", so renaming this feature to the party form after Paperform is retired only touches code.

## Rollout

The custom form will go live at one pilot studio first, alongside the Paperform, and then at every studio. Customers receive `/forms/party?id=…` links, which `hosted-paperform-redirect.ts` resolves at click time. That redirect is where the switch happens, so links sent before launch move over too (see the TODO there).

While both forms are live they share the booking pipeline and the Square catalogue. The Paperform keeps its own cake, flavour and addition lists, so changes made in Square must also be made in the Paperform until it is retired. Square does not enforce the cake item's required modifier lists on API orders, so the Paperform checkout keeps working.
