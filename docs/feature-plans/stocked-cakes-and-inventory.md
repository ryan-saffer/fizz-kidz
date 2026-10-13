# Stocked Cakes And Inventory Go-Live

Branch: `cake-inventory`. Supersedes the consumables-first design in [`../inventory-system-plan.md`](../inventory-system-plan.md).

## Why

Our cake supplier delivers weekly to most studios, so cakes are ordered per party and the supplier is emailed (now `party-form/booking/apply-party-form.ts`). It cannot reach Werribee and Geelong weekly, so `canOrderCake()` in `packages/core/src/parties/party.utils.ts` excludes them.

The supplier now drops a preset number of cakes at Werribee and Geelong once a month: medium only, already chocolate/vanilla, a limited set of designs. Lolly bags (take-home bags ordered on the party form) are also stocked at those studios. Families there should only be able to order what is physically in that studio, and an order must immediately reserve the stock so nobody else can take it.

The inventory system (built, not used in production, no backwards compatibility needed) becomes the source of truth for this, and goes live for party food at the same time. Inventory only tracks food: the categories are party food, cakes and take-home bags.

## Operating rules (from head of ops)

- Werribee/Geelong cakes are only orderable on the **party form** (sent about 1–2 weeks out). Not at booking time and not on the cake form (sent 3–4 weeks out). These studios stop getting the weekly cake-form email.
- Families only see cakes currently available at their studio. Selecting one reserves it immediately.
- Deliveries are physically checked by a supervisor/area manager/franchisee, then entered via **Receive** (never by counting the freezer).
- Discrepancies between the system and the freezer are flagged with a reason, not silently corrected.
- Ownership of low-stock alerts reflects the studio model: Werribee (franchise) goes to Paris; Geelong (corporate) goes to Courtney/AM plus the Customer team.
- Opening balance is the first reconciled delivery, entered through Receive before ordering is switched on.

## Decisions

- **Shelf life is ignored.** If a cake spoils, staff remove it with a reason. Add expiry only if it becomes necessary.
- **One inventory, one page.** "In stock" always means physically there. Reservation is an extra layer that applies only to items customers order (linked to a Square catalog object). Party food never shows reserved numbers.
  - `on hand` = physical count, including reserved stock.
  - `reserved` = held for upcoming bookings.
  - `available` = on hand − reserved. This is what customers can order.
  - So counting the freezer is safe: the count should equal on hand. Staff never need to know which unlabelled cake is whose.
- **Lifecycle** (every step writes a stock movement, keyed by booking where relevant):
  - Receive delivery: on hand +n
  - Party form order: reserved +n (before the card is charged; released if payment fails)
  - Booking cancelled: reserved −n
  - Party paid on the studio terminal: on hand −n, reserved −n
  - Thrown out or damaged: on hand −n, with a reason
- **Count mismatch = option A.** A reason is required, stock is adjusted, and the studio owners are emailed. If on hand would drop below reserved (a party will be short), show a loud warning and include it in the owner email.
- **Running low** is the only threshold. "Keep at least" (`minimumTargetQuantity`) is removed. For orderable items it compares against _available_.
- **Lolly bags** use the same reservation mechanism, by quantity. The party form caps the quantity at available.
- **Shopping list and usage rules are parked.** Hide them from the UI and leave the server code alone.
- **Rare cases are not handled:** party moved to another studio, staff editing a cake. Our team will see the cake on the booking and fix it manually.
- **Alerts** go to the studio's contact email (`getStudioContactEmail`), so there's no separate owners list to keep in sync.
- **Catalogue restriction lives on our server.** Square keeps price, images and the charge. Inventory decides which designs and bags are offered at stocked studios: size fixed to Medium, flavour question skipped (chocolate and vanilla).
- **The custom party form is required.** The Paperform couldn't check stock. Develop has since retired the Paperform for every studio.

## Phases

1. **Inventory go-live**
   - Threshold-only running low; remove unused fields (`minimumTargetQuantity`, `reorderPoint`, `parLevel`, `reorderLevel`, `targetLevel`, `purchaseOptions`).
   - Hide the shopping list and usage-rules tabs.
   - Grant permissions to studio roles.
   - Per-studio owner alert email when an item crosses its running-low threshold.
2. **Stocked items**
   - Items get an optional Square catalog link (cake design modifier or take-home bag variation), and stock levels get `reservedQuantity`.
   - Add Receive, Count (mismatch needs a reason and notifies owners) and Remove (thrown out) flows.
   - Add a Cakes area on the inventory page and movement history.
   - Ship before ordering so the opening balance can be entered.
3. **Werribee and Geelong onto the custom party form.** Done by develop, which removed the party Paperform everywhere.
4. **Ordering on**
   - `canOrderCake()` becomes "supplier cake" vs "stocked cake".
   - Stock-driven cake and lolly bag options.
   - Reserve in the checkout transaction before `payCheckout`, and release on failure.
   - Studio notification instead of the supplier email.
   - Release on cancel, plus a daily used job.
   - Skip the cake-form email for stocked studios.

## Status (2026-10-02)

All four phases are built on `cake-inventory` and uncommitted. Tests, type checks and the docs build pass. The user hasn't tested the UI yet.

- [x] Phase 1: permissions are admin, manager and studio iPad (view, receive, count, remove) and super admin (also items). The iPad was given stock changes on 2026-10-12; its changes are recorded as the shared iPad login. Alerts go to the studio's contact email (`getStudioContactEmail`), the one central list of studio addresses (changed from a separate owners list on 2026-10-13).
- [x] Phase 2: Receive delivery, Count (an orderable mismatch needs a reason and notifies the owners), Remove, Stock history, and the Square link on items.
- [x] Phase 3: no longer needed. Develop moved every studio to the custom party form.
- [x] Phase 4: stocked cake and bag options, availability checks, reserve after payment, studio email instead of the supplier, release on booking delete. Reserved stock is used when the party is paid on the studio terminal (changed from a daily job on 2026-10-12).

## Changes from the original plan

- **Reserving after payment.** Stock is reserved _after_ payment, not before, so there's no release or retry logic for declined cards. Availability is checked when the order summary is prepared and again before charging. Two parents paying for the last cake at once still both get recorded, and the studio goes short. That emails the owners.
- **Same mechanism for every orderable item.** Lolly bags (and any linked kit) use the same mechanism as cakes. The party form caps quantities at what's available.

## Cake supplies (2026-10-12)

- Cups, spoons and candles are a **Cake supplies** category, in Receive delivery and Count stock with cakes and bags.
- Each is linked to the serving or candle option that uses it (several items can share one), with **Used per party**: one per party (candles) or 1.5 per child, rounded up (cups, spoons).
- They're never reserved or limited on the party form. At stocked studios, paid serving and candle options with no linked supply aren't offered, which removes waffle cones.
- They come off stock when the party is paid on the studio terminal, using the children charged.

## Confirming at checkout (2026-10-12)

The terminal checkout has a **Cake** step for parties with a studio-stock cake. It says the cake is already paid, and asks staff to confirm the cake and its supplies were used. The answer goes on the Square order (`cakeUsage`), so the iPad and the webhook settle stock the same way. A used cake comes off stock; an unused one is released back to available. Supplies come off only if confirmed.

## Before go-live

- [x] Werribee added to terminal checkout (`TERMINAL_CHECKOUT_TRIAL_STUDIOS`), so its party stock is used when parties are paid on the terminal. This also turns on product sales on the terminal there.
- [x] Firestore index for stock history (`inventoryStockMovements` location, itemId, createdAt desc) already exists in `firestore.indexes.json`.
- [ ] Square, at the Geelong and Werribee locations:
  - the cake designs, the Medium size, and the Chocolate and Vanilla flavours must be sold there;
  - stocked cakes match flavours by name containing "chocolate" or "vanilla".
- [ ] Super admin creates one inventory item per stocked cake design and per lolly bag, each linked in "Ordered by customers as", plus cups, spoons and candles in Cake supplies, linked in "Used by". Set running-low thresholds.
- [ ] Enter the reconciled first delivery through Receive delivery (the opening balance).

## Open questions

- Are kits (products) also stocked at Geelong and Werribee? They're only limited if linked to an inventory item.
