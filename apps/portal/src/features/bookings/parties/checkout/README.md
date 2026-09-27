# Party checkout

Collecting a party's payment on a studio iPad. Staff press **Collect payment** on a studio party (the `bookings:collect-payment` permission: studio iPads and super-admins; checked in the portal only), confirm what's being charged, and the charge goes to the studio's Square Terminal. The server side, including what's charged and why, is in `apps/server/src/features/party-bookings/core/party-checkout`.

## How it works

Start with `state/checkout-store.ts`. The store holds the whole checkout: the answers (length, food package, children, additions, discount, gift card), Square's price for them, and the charge on the terminal. Components read from it and call its actions. `CheckoutDialog` loads the booking's checkout config and registers the tRPC mutations with the store.

1. **Party**: length, food package and the children who came (charged for at least 12).
2. **Food**: the food additions, prefilled from the party form.
3. **Review & charge**: which terminal this iPad uses, an optional gift card or discount (hidden behind links, since they're rare; a discount needs a reason, which isn't shown to the customer), and **Charge**.

`OrderSummary` sits beside the steps for the customer to follow. While staff edit it's an estimate from Square's prices (`estimateCharge`); on the review step the store prepares the checkout and it shows Square's priced order, which is what's charged. Changing an answer there prepares it again.

Charging sends the prepared order to the terminal, then checks it every two seconds until it's paid or cancelled. Staff can cancel from the iPad. A cancelled charge can be sent again (a fresh checkout for the same answers) or edited first. If sending gets no clear answer, Charge sends the same checkout again, which Square won't repeat. Checking keeps going through dropped connections, but if the server fails five times in a row the checkout stops and tells staff to check Square before charging again, since the payment may have gone through. Once paid, the booking shows **Paid** with a link to the receipt, and the parent is emailed a receipt.

`state/checkout-storage.ts` keeps a charge on the terminal in the iPad's local storage, so reopening the checkout after a reload keeps waiting for it instead of charging again.

## Terminals

Each studio has one terminal: the one paired with the portal at its Square location, used automatically on any iPad, so staff never choose it. Nothing about it is stored on the iPad or in Firestore; the pairing in Square is the link. `components/terminal-picker.tsx` shows it on the review step. With none paired, staff pair it there once: **Get code** shows a code to enter on the terminal's sign-in screen (**Device code**), and the terminal is named after the studio (e.g. 'Cheltenham Terminal'). To replace a terminal, delete the old one in the Square Dashboard (**Devices**, ⋯ → **Delete**), then pair the new one; Square can't remove a pairing any other way, and signing a terminal out doesn't. Until the old one is deleted, the iPad shows both and asks which to use.

In dev the list is Square's sandbox test devices, which each act out a result (succeeds, customer cancels, times out, offline), so staff pick one per checkout. Sandbox party prices are in cents so test charges stay under Square's sandbox limit.

## Tests

```bash
vp test --run --project portal apps/portal/src/features/bookings/parties
```
