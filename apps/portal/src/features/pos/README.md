# Product sales

Selling our kits to a customer on the studio's Square Terminal, in place of the Square Point of Sale app. **Sell products** is in the dashboard menu for studio iPads and super-admins (the `products:sell` permission), at studios trialling terminal checkout (`TERMINAL_CHECKOUT_TRIAL_STUDIOS` in `packages/core`, shared with party checkout; super-admins can sell at every studio, and dev offers it everywhere). A studio iPad sells at its own studio; head office picks the studio.

It's built on the shared terminal checkout (`features/terminal-checkout`), so it works like collecting a party's payment:

1. **Products**: tap a product to add it, and set how many. Products and prices come from the Square **Products** category.
2. **Review & charge**: the shared review step, with the terminal, an optional gift card or staff discount, and **Charge**.

The terminal offers the customer a receipt once they've paid, and **New sale** starts the next one. `state/pos-store.ts` is the store (the subject is the studio); `components/pos-dialog.tsx` loads the studio's products and registers the tRPC calls. The server side is `apps/server/src/features/pos`.

## Tests

```bash
vp test --run --project portal apps/portal/src/features/pos
```
