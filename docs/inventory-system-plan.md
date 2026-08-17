# Inventory System Implementation Plan

## Goal

Build a first-party inventory system for Fizz Kidz, starting with party food and keeping the data model broad enough to later support consumables such as glue, slime containers, take-home bag supplies, and other operational stock.

The first implementation stage should only create the backend capability to define inventory items, store stock by location, record stock movements, and expose those capabilities over tRPC. The inventory viewing page, stocktake flow, and shopping-list generation should be planned now but built later.

## Implementation Checklist

- [x] Review the area-manager stocktake spreadsheet and capture relevant design implications.
- [x] Update the plan for consumables-only inventory.
- [x] Update the plan for exact quantity tracking and qualitative stock levels.
- [x] Add shared inventory types and constants in `packages/core/src/inventory/index.ts`.
- [x] Export inventory types from `packages/core/src/index.ts`.
- [x] Add inventory permissions to `packages/core/src/core/permission.ts`.
- [x] Add typed Firestore refs for inventory collections in `apps/server/src/integrations/firebase/firestore.refs.ts`.
- [x] Add `DatabaseClient` inventory item, stock-level, and stock-movement methods.
- [x] Make inventory item creation also create initial location stock records.
- [x] Implement transaction-backed stock movement writes.
- [x] Add global hard delete for inventory items, including all studio stock levels and movement history.
- [x] Add studio-scoped used/unused tracking via `InventoryStockLevel.stocked`.
- [x] Add `apps/server/src/features/inventory/core` utilities for inventory operations.
- [x] Add an `inventory` tRPC router with zod input validation.
- [x] Move inventory auth and permission checks into inventory-scoped tRPC procedures.
- [x] Move inventory operation schemas into core modules so tRPC and server functions share the same input type.
- [x] Standardise inventory discriminated union keys with the `$` prefix.
- [x] Register the inventory router in `apps/server/src/app/trpc/app.trpc.ts`.
- [x] Run `vp check` across the workspace (formatting, lint, type-aware lint, and TypeScript for Portal, server, and shared core).
- [ ] Add tests for stock movement transactions and permission checks.
- [ ] Create an initial seed/admin script for party-food inventory items if needed.
- [x] Build the inventory page for creating items and viewing current stock by location.
- [x] Add manual stock adjustment UI for receiving stock, stocktake count corrections, and qualitative level updates.
- [ ] Build the stocktake database model and workflow.
- [ ] Build usage rules for mapping bookings/additions to inventory demand.
- [ ] Build the upcoming-week shopping-list generator.
- [ ] Add automated stock deductions for paid bookings where the item is quantity-tracked.

## Existing Repository Patterns

Inventory should follow the current repository architecture instead of becoming a separate subsystem with different conventions.

- Shared domain types belong in `packages/core/src` and are exported from `packages/core/src/index.ts`.
- Typed Firestore collection/document references belong in `apps/server/src/integrations/firebase/firestore.refs.ts`.
- Low-level database reads/writes belong in `apps/server/src/integrations/firebase/database.client.ts`.
- Feature/business operations belong in `apps/server/src/<feature>/core`.
- tRPC routers belong in `apps/server/src/<feature>/functions/trpc` and are registered in `apps/server/src/app/trpc/app.trpc.ts`.
- The Portal consumes the server router through the existing typed tRPC client in `apps/portal/src/integrations/trpc.ts`.

## Design Principles

- Keep `core` as the source of truth for shared inventory types.
- Keep Firestore writes behind `DatabaseClient` and inventory core functions.
- Do not update stock quantities directly from tRPC handlers or UI code.
- Every stock quantity change should write an immutable stock movement record.
- Use Firestore transactions for stock adjustments so the current stock measurement and movement log cannot drift.
- Prefer archiving inventory items over deleting them once they have been used.
- Avoid coupling inventory items directly to party-booking fields. Use explicit usage rules later to map bookings/additions to stock requirements.
- Start with party food, but model items generically so non-food consumables can be added without a schema rewrite.
- This system should only track consumables. Reusable equipment such as bowls, jugs, plates, and utensils should not be modelled here.
- Support both exact stock counts and qualitative stock levels. Some items, such as party pies, can be counted exactly; other items, such as bicarb soda or bulk buckets, may only be realistic to record as `high`, `medium`, `low`, `out`, or `unknown`.

## Shared Type Model

Add a new shared module:

- `packages/core/src/inventory/index.ts`

Export it from:

- `packages/core/src/index.ts`

Recommended initial types:

```ts
import type { Studio } from "../core/studio";

export const INVENTORY_CATEGORIES = [
  "party-food",
  "paint",
  "glitter",
  "glue",
  "pigment",
  "soap-and-bath",
  "bath-bombs",
  "fragrance-and-dye",
  "decorations",
  "cleaning",
  "packaging",
  "other",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const INVENTORY_UNITS = [
  "each",
  "serve",
  "pack",
  "box",
  "tray",
  "bag",
  "bottle",
  "container",
  "bucket",
  "can",
  "jar",
  "tub",
  "kg",
  "g",
  "l",
  "ml",
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const INVENTORY_QUALITATIVE_STOCK_LEVELS = [
  "unknown",
  "out",
  "low",
  "medium",
  "high",
] as const;

export type InventoryQualitativeStockLevel =
  (typeof INVENTORY_QUALITATIVE_STOCK_LEVELS)[number];

export type InventoryLocation = Studio;

export type BaseInventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  status: "active" | "archived";
  purchaseOptions?: InventoryPurchaseOption[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type QuantityTrackedInventoryItem = BaseInventoryItem & {
  $trackingMode: "quantity";
  baseUnit: InventoryUnit;
  runningLowThreshold: number | null;
};

export type QualitativeInventoryItem = BaseInventoryItem & {
  $trackingMode: "qualitative";
  baseUnit?: InventoryUnit;
};

export type InventoryItem =
  | QuantityTrackedInventoryItem
  | QualitativeInventoryItem;

export type InventoryPurchaseOption = {
  label: string;
  unit: InventoryUnit;
  quantityInBaseUnits: number;
  supplier?: string;
};

export type InventoryStockLevel = {
  id: string;
  itemId: string;
  location: InventoryLocation;
  stocked: boolean;
  measurement: InventoryStockMeasurement;
  reorderPoint?: number;
  parLevel?: number;
  reorderLevel?: InventoryQualitativeStockLevel;
  targetLevel?: InventoryQualitativeStockLevel;
  lastMovementAt?: Date;
  updatedAt: Date;
};

export type InventoryStockMeasurement =
  | {
      $type: "quantity";
      quantity: number | null;
    }
  | {
      $type: "qualitative";
      level: InventoryQualitativeStockLevel;
    };

export type InventoryStockMovementSource =
  | "manual-adjustment"
  | "stocktake"
  | "booking-usage"
  | "purchase"
  | "transfer"
  | "system";

export type InventoryStockMovement = {
  id: string;
  itemId: string;
  location: InventoryLocation;
  source: InventoryStockMovementSource;
  adjustment: InventoryStockMovementAdjustment;
  reason?: string;
  createdAt: Date;
  createdBy: {
    uid: string;
    email: string;
  };
};

export type InventoryStockMovementAdjustment =
  | {
      $type: "quantity";
      $operation: "adjust";
      delta: number;
      quantityBefore: number;
      quantityAfter: number;
    }
  | {
      $type: "quantity";
      $operation: "set";
      quantityBefore: number | null;
      quantityAfter: number | null;
    }
  | {
      $type: "qualitative";
      levelBefore: InventoryQualitativeStockLevel;
      levelAfter: InventoryQualitativeStockLevel;
    };
```

Notes:

- `InventoryLocation` should be `Studio`, not `StudioOrMaster`. Stock exists at a real studio location, not at the `master` organisation level.
- Quantity-tracked stock should always be expressed in the item's `baseUnit`.
- Quantity-tracked items can define `runningLowThreshold`; when a studio's known quantity is at or below that value, the UI should show a visible running-low badge. Use `null` to disable the badge for an item.
- Quantity-tracked stock can be `null` when the current count is unknown and someone needs to count it; this is different from quantity `0`, which means counted and out of stock.
- Qualitative stock should be used when exact counts create false precision. It still supports stocktake, reporting, and shopping-list warnings, but automated booking deductions should only mutate exact quantity-tracked stock.
- `purchaseOptions` allows examples like one box equals 40 packets or one tray equals 24 serves while keeping stock math normalized.
- `InventoryStockLevel.id` should be deterministic, probably `${location}_${itemId}`, so each item/location pair has exactly one current stock document.
- `stocked: false` represents items that a specific studio does not carry.

## Spreadsheet Findings

The stocktake spreadsheet in `docs/Post April SH Studio Stock Take 2026.xlsx` should inform the design even though those items are not the initial party-food rollout.

- The current operational template uses item categories, item names, a recorded unit, quantity recorded, status, par level, action required, and notes.
- The status values are effectively `OK`, `LOW`, `NOT_REPORTED`, and `NOT_STOCKED`.
- Par levels are location-specific in practice. For example, a glitter colour can have a par level at one studio and `none` at another.
- Counts are sometimes exact, such as `113` creation bowls, and sometimes qualitative or approximate, such as `full tubs`, `half container`, `80+`, or `22x various`.
- The system should not force rough stocktake notes into fake exact numbers. Use qualitative measurements until the item has a reliable exact unit.
- Equipment rows in the spreadsheet should be excluded from this inventory system. They are useful only as a reminder that future spreadsheet imports need item/category filtering.
- The future stocktake feature should retain raw count notes alongside normalized measurements so area managers can see what was actually submitted.

## Firestore Collections

### `inventoryItems`

One document per inventory item. This is the global item catalogue.

Suggested document shape:

```ts
type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  status: "active" | "archived";
  $trackingMode: "quantity" | "qualitative";
  baseUnit?: InventoryUnit;
  runningLowThreshold?: number | null;
  minimumTargetQuantity?: number | null;
  purchaseOptions?: InventoryPurchaseOption[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

Example IDs:

- `chicken-nuggets`
- `fairy-bread`
- `watermelon-platter`
- `slime-container-250ml`

Use stable, readable IDs for seeded/common items if helpful, but generated IDs are also acceptable. If item IDs are generated, add a separate slug later only if the UI or imports need it.

### `inventoryStockLevels`

One document per item/location pair. This is the fast-read current stock table.

Suggested document shape:

```ts
type InventoryStockLevel = {
  id: string;
  itemId: string;
  location: Studio;
  stocked: boolean;
  measurement: InventoryStockMeasurement;
  reorderPoint?: number;
  parLevel?: number;
  reorderLevel?: InventoryQualitativeStockLevel;
  targetLevel?: InventoryQualitativeStockLevel;
  lastMovementAt?: Date;
  updatedAt: Date;
};
```

Recommended document ID:

```ts
`${location}_${itemId}`;
```

This avoids duplicate stock-level documents for the same item at the same location and makes direct lookups simple.

Expected queries:

- List all stock for one studio: `where('location', '==', studio)`.
- List stock for one item across locations: `where('itemId', '==', itemId)`.
- Get one stock level directly by deterministic ID.

### `inventoryStockMovements`

Append-only audit log for stock changes. Every stock adjustment should create one movement.

Suggested document shape:

```ts
type InventoryStockMovement = {
  id: string;
  itemId: string;
  location: Studio;
  source: InventoryStockMovementSource;
  adjustment: InventoryStockMovementAdjustment;
  reason?: string;
  createdAt: Date;
  createdBy: {
    uid: string;
    email: string;
  };
};
```

Expected queries:

- Recent movements for a location: `where('location', '==', studio).orderBy('createdAt', 'desc')`.
- Movement history for one item/location: `where('itemId', '==', itemId).where('location', '==', studio).orderBy('createdAt', 'desc')`.

## Future Firestore Collections

Do not build these in the first implementation unless needed by the first UI milestone.

### `inventoryStocktakes`

One document per stocktake session.

Suggested shape:

```ts
type InventoryStocktake = {
  id: string;
  location: Studio;
  status: "draft" | "submitted" | "cancelled";
  startedAt: Date;
  startedBy: { uid: string; email: string };
  submittedAt?: Date;
  submittedBy?: { uid: string; email: string };
  notes?: string;
};
```

### `inventoryStocktakes/{stocktakeId}/counts`

One count per item in a stocktake.

Suggested shape:

```ts
type InventoryStocktakeCount = {
  id: string;
  stocktakeId: string;
  itemId: string;
  expectedMeasurement: InventoryStockMeasurement;
  countedMeasurement?: InventoryStockMeasurement;
  status: "ok" | "low" | "not-reported" | "not-stocked";
  rawCount?: string;
  variance?: number;
  notes?: string;
  updatedAt: Date;
};
```

Submitting a stocktake should apply one `stocktake` movement for every item where the normalized count changes the current stock measurement. Submission must be idempotent by checking `status` inside a Firestore transaction.

### `inventoryUsageRules`

Maps business events, such as a party-food addition, to required stock items.

Suggested shape:

```ts
type InventoryUsageRule = {
  id: string;
  status: "active" | "archived";
  trigger: InventoryUsageTrigger;
  itemId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

type InventoryUsageTrigger =
  | {
      $type: "party-addition";
      addition: Addition;
    }
  | {
      $type: "party-menu";
      menu: "standard" | "glutenFree" | "vegan";
    }
  | {
      $type: "party-child-count";
      item: "napkins" | "lolly-bags";
      quantityPerChild: number;
    };
```

This should be expanded when the shopping-list feature is built. It intentionally maps from existing booking concepts to inventory items rather than embedding inventory IDs in party booking types.

### `inventoryShoppingLists`

Saved generated shopping lists.

Suggested shape:

```ts
type InventoryShoppingList = {
  id: string;
  location: Studio;
  startDate: Date;
  endDate: Date;
  status: "draft" | "ordered" | "completed" | "cancelled";
  createdAt: Date;
  createdBy: { uid: string; email: string };
};
```

### `inventoryShoppingLists/{shoppingListId}/lines`

Suggested shape:

```ts
type InventoryShoppingListLine = {
  id: string;
  shoppingListId: string;
  itemId: string;
  requiredQuantity: number;
  stockMeasurement: InventoryStockMeasurement;
  suggestedPurchaseQuantity?: number;
  warning?: string;
  purchaseUnit?: InventoryUnit;
  notes?: string;
};
```

## Stage 1: Database Types And Low-Level Firestore Access

### Files To Change

- Add `packages/core/src/inventory/index.ts`.
- Update `packages/core/src/index.ts` to export inventory types.
- Update `apps/server/src/integrations/firebase/firestore.refs.ts` with inventory refs.
- Update `apps/server/src/integrations/firebase/database.client.ts` with inventory database methods.

### `FirestoreRefs` Additions

Add typed refs for:

```ts
static async inventoryItems()
static async inventoryItem(id: string)
static async inventoryStockLevels()
static async inventoryStockLevel(location: Studio, itemId: string)
static async inventoryStockMovements()
static async inventoryStockMovement(id: string)
```

Add a small helper for the deterministic stock-level document ID:

```ts
export function getInventoryStockLevelId(location: Studio, itemId: string) {
  return `${location}_${itemId}`;
}
```

This helper can live in `packages/core/src/inventory/index.ts` if the Portal also needs to reason about IDs, or beside `FirestoreRefs` if it is server-only. Prefer shared only if the Portal has a concrete need.

### `DatabaseClient` Additions

Add methods for item catalogue operations:

```ts
createInventoryItem(item: WithoutId<InventoryItem>)
getInventoryItem(itemId: string)
listInventoryItems(input?: { includeArchived?: boolean; category?: InventoryCategory })
updateInventoryItem(itemId: string, item: UpdateDoc<InventoryItem>)
```

Add methods for stock reads:

```ts
getInventoryStockLevel(input: { location: Studio; itemId: string })
listInventoryStockLevels(input?: { location?: Studio; itemId?: string })
```

Add a transaction-backed write method:

```ts
applyInventoryStockMovement(input: {
    itemId: string
    location: Studio
    adjustment:
        | { $type: 'quantity'; delta: number }
        | { $type: 'qualitative'; level: InventoryQualitativeStockLevel }
    source: InventoryStockMovementSource
    reason?: string
    createdBy: { uid: string; email: string }
})
```

Transaction requirements:

- Read the stock-level document by deterministic ID.
- If a quantity-tracked stock level is missing, treat `quantityBefore` as `0` and create the stock-level document.
- For quantity adjustments, calculate `quantityAfter = quantityBefore + delta`.
- For qualitative adjustments, record the previous level and new level.
- Reject negative resulting stock unless the business decides negative stock is allowed. Default recommendation: reject it.
- Write the updated stock-level document.
- Create a movement document in `inventoryStockMovements`.
- Return the updated stock level and movement.

Add movement reads:

```ts
listInventoryStockMovements(input: {
    location?: Studio
    itemId?: string
    limit?: number
})
```

Start with simple query shapes. Add pagination only when the UI needs it.

## Stage 2: Server Core Utilities

Create:

- `apps/server/src/features/inventory/core/create-inventory-item.ts`
- `apps/server/src/features/inventory/core/update-inventory-item.ts`
- `apps/server/src/features/inventory/core/list-inventory-items.ts`
- `apps/server/src/features/inventory/core/list-inventory-stock.ts`
- `apps/server/src/features/inventory/core/adjust-inventory-stock.ts`
- `apps/server/src/features/inventory/core/list-inventory-stock-movements.ts`
- `apps/server/src/features/inventory/core/inventory-permissions.ts`

Core functions should contain business rules that should not live in tRPC handlers, such as:

- Required item fields.
- Archive instead of delete.
- Stock cannot become negative.
- User must have access to the requested location.
- `master` users can manage all studios, but stock records are always scoped to a concrete `Studio`.

Recommended core API:

```ts
export async function createInventoryItem(input: CreateInventoryItemInput);
export async function updateInventoryItem(input: UpdateInventoryItemInput);
export async function listInventoryItems(input: ListInventoryItemsInput);
export async function listInventoryStock(input: ListInventoryStockInput);
export async function adjustInventoryStock(input: AdjustInventoryStockInput);
export async function listInventoryStockMovements(
  input: ListInventoryStockMovementsInput,
);
```

## Stage 3: tRPC Router

Create:

- `apps/server/src/features/inventory/functions/trpc/inventory.trpc.ts`

Register in:

- `apps/server/src/app/trpc/app.trpc.ts`

Recommended router surface:

```ts
export const inventoryRouter = router({
    listItems: authenticatedProcedure.query(...),
    createItem: authenticatedProcedure.mutation(...),
    updateItem: authenticatedProcedure.mutation(...),
    listStock: authenticatedProcedure.query(...),
    adjustStock: authenticatedProcedure.mutation(...),
    listMovements: authenticatedProcedure.query(...),
})
```

Use `zod` for runtime input validation in this new router. Older routers sometimes use cast-only inputs, but this feature should start with stricter validation because inventory writes affect operational records.

Example validation module:

- `apps/server/src/features/inventory/functions/trpc/inventory.schema.ts`

Validation should use shared constants from `core`, for example `INVENTORY_CATEGORIES`, `INVENTORY_UNITS`, and `STUDIOS`, so runtime validators and TypeScript types cannot drift.

## Permissions

Update:

- `packages/core/src/core/permission.ts`

Add permissions:

```ts
"inventory:read";
"inventory:write";
"inventory:stocktake";
"inventory:shopping-list";
```

Suggested role mapping:

- `admin`: all inventory permissions.
- `manager`: `inventory:read`, `inventory:write`, `inventory:stocktake`, `inventory:shopping-list`.
- `studio-ipad`: `inventory:read`, `inventory:stocktake`.
- `facilitator`: no inventory permission initially.

Server-side enforcement is required. Client-side hiding is not sufficient.

Recommended server check:

- Load the authenticated user from `DatabaseClient.getUser(uid)`.
- Confirm they are a staff user.
- Confirm the requested `location` is either directly present in `user.roles` with the required permission, or the user has a `master` role with the required permission.
- Never allow inventory operations against the pseudo-location `master`.

## Party Food Starting Point

Current party food/addition data lives in:

- `packages/core/src/parties/booking.ts`
- `packages/core/src/parties/additions.ts`

Initial party-food candidates from `PROD_ADDITIONS`:

- `chickenNuggets`
- `fairyBread`
- `fruitPlatter`
- `frankfurts`
- `sandwichPlatter`
- `vegetarianQuiche`
- `watermelonPlatter`
- `wedges`

Party pack additions are active additions, but should only be added to inventory if the business wants those tracked from day one:

- `dinosaurFizzPartyPack`
- `unicornFizzPartyPack`

Do not remove or ignore deprecated additions at the type level. Old bookings may still contain them, so future usage-rule code should be able to understand `ADDITIONS`, not just `PROD_ADDITIONS`.

## Feature Milestone 1: Inventory Page

Do not build this in the initial backend stage. Plan for it after the tRPC surface exists.

Likely files:

- `apps/portal/src/features/inventory/pages/inventory-page.tsx`
- `apps/portal/src/features/inventory/components/inventory/inventory-items-table.tsx`
- `apps/portal/src/features/inventory/hooks/use-inventory-location.ts`

Route:

- `/inventory`

Navigation:

- Add an Inventory tile to the current admin/tools navigation section.

Initial UI capabilities:

- View current inventory by location.
- Filter by location.
- Filter by category and active/archived status.
- Show item name, category, measurement, reorder threshold, target level, and last movement date.
- Perform a basic manual stock adjustment if `inventory:write` is allowed.

tRPC calls:

- `trpc.inventory.listItems.queryOptions(...)`
- `trpc.inventory.listStock.queryOptions(...)`
- `trpc.inventory.adjustStock.mutationOptions(...)`

## Feature Milestone 2: Stocktake

Build this after the basic inventory page is stable.

Stocktake flow:

1. User starts a stocktake for a concrete studio location.
2. System creates an `inventoryStocktakes` document with status `draft`.
3. System snapshots expected measurements into `inventoryStocktakes/{stocktakeId}/counts`.
4. User enters counted measurements, with optional raw notes for approximate counts.
5. User submits the stocktake.
6. Submission transaction checks the stocktake is still `draft`.
7. For each variance, system applies a stock movement with source `stocktake`.
8. System marks the stocktake as `submitted`.

Important rule:

- Submitting the same stocktake twice must not apply movements twice.

## Feature Milestone 3: Shopping List For Upcoming Bookings

Build this only after usage rules exist.

Initial implementation scope:

- Generate shopping lists on demand from current bookings, usage rules, catalogue items, and stock levels.
- Do not persist generated shopping lists yet. Add `inventoryShoppingLists` only once staff need saved lists, completion status, or purchase history.
- Studio users generate a list for their own studio only.
- Master users generate one combined response grouped by studio.
- Start with party bookings only: base party items, food-package items when `includesFood` is true, and selected party additions.

Shopping-list generation flow:

1. User selects location and date range, probably the upcoming week.
2. Server fetches upcoming party bookings for that location/date range.
3. Server evaluates `inventoryUsageRules` against each booking.
4. Server sums required quantities per item.
5. Server fetches current stock levels.
6. Server calculates suggested purchase quantity for quantity-tracked items and a reorder warning for qualitative items.
7. User can review the generated report grouped by studio. Saving can come later.

Usage-rule document shape:

```ts
type InventoryUsageRule = {
  id: string;
  inventoryKey: string;
  label?: string;
  status: "active" | "archived";
  quantity:
    | { $operation: "fixed"; quantity: number }
    | { $operation: "per-child"; quantityPerChild: number }
    | {
        $operation: "fixed-plus-per-child";
        fixedQuantity: number;
        quantityPerChild: number;
      };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
} & (
  | { $type: "party-base" }
  | { $type: "party-food-package" }
  | { $type: "party-addition"; addition: Addition }
);
```

Inventory items get an optional stable `inventoryKey` so usage rules can target a logical item without depending on a Firestore id. Staff should not type the full key manually. The UI captures a rule type and a short name, then builds keys as `${type}:${name}`. Example keys: `party-base:partyPies`, `party-food-package:fairyBread`, `party-addition:chickenNuggets`.

Generation warnings should be shown rather than failing the whole report:

- No active usage rules are configured.
- A booking has an invalid or missing `numberOfChildren`.
- A rule points to no active item with the configured `inventoryKey`.
- Multiple active items use the same `inventoryKey`.
- A required item is qualitative, because automatic purchase quantities require quantity tracking.
- A required item has no stock-level record for that studio.
- A required item is marked unused at that studio.
- A required item has an unknown stock count.

Suggested calculation:

```ts
suggestedPurchaseQuantity = Math.max(
  requiredQuantity + minimumTargetQuantity - quantityOnHand,
  0,
);
```

Where `minimumTargetQuantity` is the optional per-item shopping-list buffer, defaulting to `0` when blank.

Qualitative items should not receive automated deductions. If a qualitative item is required for upcoming bookings, the shopping list should surface a warning such as `check bicarb level` or `reorder if low` based on the current qualitative level.

Usage rules should support party additions first. Later they can support creations, holiday programs, after-school programs, or any other stock-consuming workflow.

## Type Safety Strategy

- Define shared domain types and runtime constants in `core`.
- Export all inventory types from `packages/core/src/index.ts`.
- Use those types in `FirestoreRefs`, `DatabaseClient`, server core functions, tRPC handlers, and the Portal UI.
- Use `zod` in new tRPC routers for runtime input validation.
- Build zod enums from shared constants so static and runtime definitions stay aligned.
- Avoid duplicating string unions in server and Portal code.
- Keep Firestore document shapes explicit and typed. Do not store arbitrary `Record<string, unknown>` blobs for inventory documents.

## Firestore Indexes To Expect

The exact indexes can be added when Firestore reports them, but these query shapes are likely:

- `inventoryStockLevels`: `location`, `itemId`.
- `inventoryStockMovements`: `location` plus `createdAt desc`.
- `inventoryStockMovements`: `location`, `itemId`, plus `createdAt desc`.
- `inventoryItems`: `status`, `category` if filtering server-side.
- `bookings`: `dateTime`, `type`, and optionally `location` for shopping-list generation.

## Testing And Verification

For implementation stages, run verification in this order:

1. `vp check`.
2. `vp test --run`.
3. `vp build` when shared or build configuration changes.

Recommended tests once stock movement logic exists:

- Creating an item stores the item with `status: 'active'`.
- Listing items excludes archived items by default.
- First stock movement creates a stock-level document from zero.
- Later stock movement updates the existing stock-level document.
- Movement log records quantity adjustments or qualitative level changes correctly.
- Stock adjustment rejects negative `quantityAfter` unless explicitly changed by business decision.
- Stocktake submission is idempotent.

## Suggested Implementation Order

1. Add shared inventory types/constants to `core`.
2. Add Firestore refs for inventory collections.
3. Add `DatabaseClient` item and stock methods, including transactional stock movement writes.
4. Add inventory permissions to shared role/permission types.
5. Add `apps/server/src/features/inventory/core` functions.
6. Add `inventory` tRPC router and register it in `appRouter`.
7. Add a small seed/admin script only if needed to create initial party-food inventory items.
8. Build the inventory page.
9. Build the stocktake flow.
10. Build usage rules and shopping-list generation.
