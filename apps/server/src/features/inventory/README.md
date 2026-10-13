# Inventory

Studio food stock: party food, plus the cakes and take-home bags Geelong and Werribee sell from studio stock. The tRPC router is `inventory` (`functions/trpc/inventory.trpc.ts`). Staff docs are in `apps/docs/src/content/docs/portal/inventory.mdx`, and the plan and decisions are in `docs/feature-plans/stocked-cakes-and-inventory.md`.

## Model

- **Items** (`inventoryItems`) are shared by every studio. A quantity item linked to a Square catalog object (`squareCatalogObjectId`: a cake design modifier or a take-home bag variation) is **orderable**: customers order it on the party form.
- **Stock levels** (`inventoryStockLevels`, one per studio and item) hold what is physically on hand. Orderable items also hold `reservedQuantity`, and available = on hand − reserved.
- **Stock movements** (`inventoryStockMovements`) are the history. Every change writes exactly one movement in the same transaction. Its `$type` says what happened (received, counted, removed, level-updated, reserved, released, used), and reservation movements carry the booking id.

## Changing stock

Every change goes through `writeInventoryStockChanges` (`core/inventory.stock.write.ts`), which:

1. Applies the changes atomically via `DatabaseClient.runInventoryStockTransaction`.
2. Uses the pure `applyInventoryStockChange` (`core/inventory.stock.changes.ts`) to work out each next stock level and movement.
3. Emails the studio (`getStudioContactEmail`), copying Kym and, for Geelong, bookings@, about anything that needs attention: running low, an orderable count that didn't match, or fewer on hand than reserved.

Staff entry points are receive (a whole delivery at once), count, remove and update-level. An orderable count that doesn't match needs a reason.

## Reservations

`core/inventory.reservations.ts`:

- **Reserve**: the party form reserves what was paid for, after payment (`party-bookings/core/party-form`).
- **Release**: deleting a booking releases its reservations.
- **Cake supplies** (`core/inventory.cake-supplies.ts`) aren't reserved. Each is linked to the serving or candle option that uses it, so `getStockedPartyFormCakeOptions` only offers paid options a studio has supplies for, and when the party is paid on the terminal `useCakeSuppliesForBooking` takes off one per party or 1.5 per child (`getCakeSupplyQuantity`).
- **Use**: staff confirm on the terminal checkout's cake step what was used. When the party is paid on the studio terminal (`party-bookings/core/party-checkout`), `useInventoryForBooking` takes its reserved stock off what's on hand. A party paid any other way keeps its stock reserved.

Outstanding reservations are worked out from a booking's movements, and each step uses an idempotency key, so repeating one does nothing.

The shopping list and usage rules are parked: the server code still exists, but the portal no longer shows them.
