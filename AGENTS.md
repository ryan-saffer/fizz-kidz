# Agent Guide

Read the root [`README.md`](README.md), then the README nearest the code being changed.

## Find The Code

- Portal routes: `apps/portal/src/app/router.tsx`
- Portal providers/tRPC: `apps/portal/src/app/root/root.tsx`
- Server HTTP: `apps/server/src/app/http/app.ts`
- Server tRPC: `apps/server/src/app/trpc/app.trpc.ts`
- Background jobs: `apps/server/src/app/background/function.ts`
- Shared exports: `packages/core/src/index.ts`
- Tooling: `package.json` and `vite.config.ts`

## Commands

Run from the repository root:

```bash
npm run dev             # Portal + server + emulators
npm run portal          # Portal only
npm run portal:local    # Portal only, against local server
npm run server          # Server only
npm run website         # Public Astro site
npm run website:local   # Public Astro site against local server
npm run website:prod    # Public Astro site against production
npm run docs            # Starlight knowledge base
npm run check           # Read-only checks
npm run test            # Core + Portal + server tests
npm run verify          # Fix checks + tests
npm run verify:full     # Include Astro checks
```

Scope tests with `vp test --run --project portal` or `vp test --run --project server`. Build Astro apps with `npm run build --workspace docs` or `npm run build --workspace website`.

## Boundaries

- Shared and runtime-neutral: `packages/core`; export from `src/index.ts`.
- Portal composition lives in `app`, user journeys in `features`, browser SDK boundaries in `integrations`, auth/organization state in `session`, and reusable UI/helpers in `shared`.
- Server composition lives in `apps/server/src/app`, business workflows in `features`, provider/runtime I/O in `integrations`, and narrow server-only helpers in `shared`.
- Dependencies flow from app adapters into features/integrations/shared and from features into integrations/shared; shared stays a leaf.
- App-specific runtime I/O may stay in its owning deployable app.
- Firestore access stays thin; workflows belong in feature `core` directories. Read `apps/server/src/integrations/firebase/README.md`.
- New Portal UI should prefer shadcn/ui and Zustand. MUI and Ant Design are legacy.
- Backend browser routes must match in `app/http/app.ts`, `firebase.json`, and the root Vite proxy.

## Code Review

Reviews (and new code) follow these rules:

- Don't over-engineer. Skip rare edge cases that are unlikely in production; log them with `logError` (Cloud Logging) instead, and fix them if they turn up often.
- Keep files and folders cleanly structured, so it's easy to see where things live.
- Portal features prefer a dedicated Zustand store over prop drilling, with the feature's core logic in the store rather than spread through components, so how a feature works can be read in one place.
- Avoid Firestore unless it's absolutely necessary; the plan is to migrate off it. Don't add collections, documents or fields for edge cases like locks, claims or processing markers on an order or booking. If Firestore seems genuinely needed, ask first.
- Follow the app's existing patterns. Don't add architecture for a single use case (e.g. a dedicated tRPC middleware or router changes for one feature). If something genuinely needs it, ask first; if the existing architecture has a real problem affecting the wider codebase, raise it as an issue instead of solving it for one feature.

Do not touch unrelated worktree changes or commit credentials. Build the affected app after changing build configuration, and update the nearest README when an important boundary changes.
