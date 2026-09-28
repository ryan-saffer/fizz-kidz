# Product sales

Selling our products (the Square **Products** category, e.g. slime kits) at a studio on its Square Terminal, in place of the Square Point of Sale app. Staff choose the products and quantities on the studio iPad, add a staff discount or gift card if needed, and charge the studio's terminal. The terminal offers the customer a receipt (email, text or printed); Square sends it.

The portal side is `apps/portal/src/features/pos`. Charging on the terminal is the shared payments module's (`features/payments`).

Tests live in a `__tests__` folder next to the files they cover.

## How a sale flows

1. **`get-pos.ts`** lists what the studio sells: the items in the Products category (`PRODUCTS_SQUARE_CATEGORY`) that are sold at the studio's Square location and have a price, in Square's order. `blocked` explains why the studio can't sell yet (it isn't trialling terminal checkout, `TERMINAL_CHECKOUT_TRIAL_STUDIOS`, prod only; super-admins can sell anywhere).
2. **`prepare-pos.ts`** checks each chosen product is still sold at the studio and calls `prepareCheckout` with them. There's no customer, so no Square customer is created and discount codes aren't offered; a staff discount needs a reason, kept in the order's metadata. The order's metadata also holds the studio, which ties the charge to it.
3. **`charge-pos.ts`** sends the order to the terminal with its receipt screen on, reports where it's up to (the portal checks every couple of seconds), and cancels.

Nothing is stored in our database: the Square order is the sale, and paying it updates the products' stock in Square. The terminal checkout webhook (see `features/payments/README.md`) settles a sale if the iPad stops watching it. The tRPC procedures are in `functions/trpc/pos.trpc.ts`, under `pos`.

Square's sandbox products are priced in cents, so test sales stay under Square's US$25 sandbox limit.
