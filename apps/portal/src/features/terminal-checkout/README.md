# Terminal checkout

Charging on a studio's Square Terminal from a studio iPad, shared by party checkout (`features/bookings/parties/checkout`) and product sales (`features/pos`) so both work the same way for staff. The server side is `apps/server/src/features/payments`.

## Making a checkout

A checkout makes its own store with `createTerminalCheckoutStore` (`state/terminal-checkout-store.ts`), giving it:

- a subject: what's being charged, e.g. a party booking or the studio selling products,
- its steps before the review step, and its answers (which always include the staff discount and gift card),
- a storage key, since a charge on the terminal is kept in the iPad's local storage per subject, so reopening the checkout after a reload keeps waiting for it instead of charging again.

Its dialog opens in `TerminalCheckoutSheet`, wraps its body in `TerminalCheckoutProvider` (the store and the studio whose terminal it charges), calls the store's `init` with its config and its tRPC calls, and shows `CheckoutSteps` with its own steps, then `ChargeStatus` once the charge is sent.

## What's shared

- **Review & charge** (`components/review-step.tsx`): the studio's terminal (`terminal-picker.tsx`: its only terminal, pairing one if there's none, or a choice of Square's sandbox test devices), an optional gift card or discount (hidden behind links, since they're rare; a discount needs a reason, which isn't shown to the customer), and **Charge**.
- **Order summary** (`order-summary.tsx`): the checkout's estimate while staff edit, then Square's priced order on the review step, which is what's charged. Changing an answer there prepares it again.
- **Charging** (`charge-status.tsx`): sending the prepared order to the terminal, then checking it every two seconds until it's paid or cancelled. Staff can cancel from the iPad. A cancelled charge can be sent again (a fresh checkout for the same answers) or edited first. If sending gets no clear answer, **Charge** sends the same checkout again, which Square won't repeat. Checking keeps going through dropped connections, but if the server fails five times in a row the checkout stops and tells staff to check Square before charging again, since the payment may have gone through. The paid screen says how the customer gets their receipt, and can offer another charge straight away (**New sale**).

## Tests

```bash
vp test --run --project portal apps/portal/src/features/terminal-checkout
```
