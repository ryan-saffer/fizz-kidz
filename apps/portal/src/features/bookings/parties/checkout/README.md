# Party checkout

Collecting a party's payment on a studio iPad. Staff press **Collect payment** on a studio party, confirm what's being charged, and the charge goes to the studio's Square Terminal. Only studio iPads and super-admins can (the `bookings:collect-payment` permission, checked in the portal only), and in prod only at the studios trialling terminal checkout (`TERMINAL_CHECKOUT_TRIAL_STUDIOS` in `packages/core`, which starts empty; add a studio there to turn it on). Super-admins can collect at every studio, and dev offers it everywhere. The server side, including what's charged and why, is in `apps/server/src/features/party-bookings/core/party-checkout`.

## How it works

The checkout is built on the shared terminal checkout (`features/terminal-checkout`), which sends the charge to the terminal, checks it, cancels and resends it, and has the review step (terminal, gift card, discount, **Charge**) and the charge's status screens. This folder adds the party's own steps and answers.

`state/checkout-store.ts` is the party's store, made with `createTerminalCheckoutStore`: the subject is the booking, the answers are the length, food package, children, additions, discount and gift card. `CheckoutDialog` loads the booking's checkout config, starts the answers from the booking, and registers the tRPC mutations.

1. **Party**: length, food package and the children who came (charged for at least 12).
2. **Food**: the food additions, prefilled from the party form.
3. **Review & charge**: the shared review step.

The order summary beside the steps is an estimate from Square's prices (`getEstimateLines`) until the review step, where it shows Square's priced order. Once paid, the booking shows **Paid** with a link to the receipt, and the parent is emailed a receipt.

## Tests

```bash
vp test --run --project portal apps/portal/src/features/bookings/parties apps/portal/src/features/terminal-checkout
```
