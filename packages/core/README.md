# `@fizz-kidz/core`

The common language spoken by the Portal, website, and server: domain types, constants, mappings, validation schemas, and pure business logic.

## The Test

Before putting code here, ask:

> Could this run in both a browser and Node without credentials, environment variables, network calls, or framework globals?

If yes, core may be the right home. If only one app needs it, leave it with that app until sharing is real.

Good fits:

- Shared domain and API types
- Calculations, validation, and transformations
- Stable IDs, constants, and integration contracts

Bad fits:

- Firebase, Firestore, or SDK clients
- React components and hooks
- Express, tRPC procedures, or Firebase Functions
- App-specific workflows and side effects

Shared UI should become a separate package rather than stretching core's contract.

## Using It

`src/index.ts` is the public surface. If another workspace should import something, export it there.

Portal and server both resolve `@fizz-kidz/core` directly to `src`, so normal development needs no package build. The server bundles core into its Functions artifact.

The website also resolves core directly to source. Its form contracts live in `src/website/website-forms.ts`: option arrays are the source for dropdowns and display mappings, Zod schemas validate in both browser and server, and `WebsiteForm` infers each submitted payload type.

```bash
npm --workspace @fizz-kidz/core run build
vp test --run --project core
```

The build command emits a normal ESM package and declarations to `dist`. The output is useful for validation and future consumers, but current apps do not depend on it at runtime. Core tests live beside their implementations in `src` and run as part of the root test suite.

Pure party-booking rules and transformations live in `src/parties/party.utils.ts`. The published party capacity schedule and its date-range calculation live in `src/parties/party-booking-capacity.ts`. Shared studio addresses, images, and review links live in `src/core/studio-details.ts`; runtime-specific form URLs and scheduling remain in the app that owns them.

`src/parties/birthday-party-catalogue.ts` defines both the full Website catalogue and a smaller booking catalogue. Each package has one canonical name, a primary colour, an accent colour, one position, and one card sequence; exactly one card per creation carries package-specific booking order. Each creation owns its operational studio/mobile availability regardless of how many packages or cards use it. Position controls Portal instruction groups and the Website menu, Party Themes, and all-creations catalogue order. The booking contract and pure helpers validate package choices, filter them by creation availability, resolve current or legacy Paperform labels to stable creation keys, and retain retired creations for historical display. The old `CREATIONS` map remains a temporary fallback for historical keys that predate Sanity. Sanity clients remain in their owning apps and return these runtime-neutral shapes.
