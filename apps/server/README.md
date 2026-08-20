# Server

The Portal's backend and shared operational infrastructure live here: Firestore, webhooks, background work, secrets, and third-party APIs. App-specific server code can stay with its owning app.

The deployment is deliberately small: one HTTP function and one Pub/Sub function.

## The Shape

- `src/index.ts` exports Firebase Functions.
- `src/app/http/api.ts` exports the HTTP function and lazily loads `src/app/http/app.ts`.
- `src/app/http/app.ts` mounts tRPC, webhooks, public API routes, and durable redirects.
- `src/app/trpc/app.trpc.ts` combines the feature routers.
- `src/app/background/function.ts` dispatches messages from the shared `background` topic.
- `src/features/<feature>/core` contains workflows.
- `src/features/<feature>/functions` contains HTTP, tRPC, webhook, or job adapters.
- `src/integrations/firebase/database.client.ts` is the Firestore boundary.
- `src/shared` contains only narrow, server-wide runtime helpers and types.

The dependency direction is `app` adapters into `features`, `integrations`, and `shared`; features may use integrations and shared modules; shared modules stay independent. Provider SDKs and runtime I/O belong in integrations. Some large provider directories still contain mixed orchestration from the old layout, notably Acuity, Paperforms, SendGrid, Zoho, and Firebase; those locations are transitional, not examples for new code.

The `api` function owns `/api/trpc`, `/api/webhooks/**`, public endpoints such as Google reviews, and `/forms/**`. The `pubsub` function handles reminders, follow-ups, form processing, onboarding, timesheets, and other deferred work.

## Rules Of Thumb

- Keep `DatabaseClient` about persistence, not business decisions. See [`src/integrations/firebase/README.md`](src/integrations/firebase/README.md).
- Put browser/server-safe contracts and pure logic in `@fizz-kidz/core`.
- Validate public website submissions with the shared schemas in `packages/core/src/website/website-forms.ts`; do not recreate payload types or cast request bodies.
- Website form mutations live in `src/features/website/functions/trpc/website-forms.trpc.ts`, delegate to the workflow in `src/features/website/core`, and are registered under `websiteForms`.
- Keep browser origins in `src/app/http/cors-origins.ts`; Firebase handles preflight before lazily loading Express.
- Keep credentials, SDK clients, Firestore, and network calls here.
- Sanity Content Lake reads belong in `src/integrations/sanity`; the Birthday Party and Holiday Program creation pages receive normalized content through tRPC, and Holiday Program Acuity classes are enriched from the same Sanity schedule.
- Name integration client modules `<provider-or-service>.client.ts`; use similarly descriptive dot-qualified names for reference registries and helpers where appropriate.
- Load heavyweight SDKs lazily; Firebase cold starts notice everything.
- Register new tRPC routers in `app/trpc/app.trpc.ts` and new background handlers in `app/background/function.ts`.

## Run It

```bash
npm run server
npm run server:prod
vp test --run --project server
npm --workspace server run build
```

Both server commands watch server and core code, type-check both, and start the Functions/Pub/Sub emulators. `server` explicitly uses the `dev` Firebase project alias; `server:prod` explicitly uses `prod`. Environment loading selects `.env` for development and `.env.prod` for production.

## Dependencies

```bash
vp add <package> --filter server
npm install --package-lock-only --ignore-scripts --workspaces=false --prefix apps/server
```

> **Do both.** Firebase Cloud Build validates the standalone `apps/server/package-lock.json`. Refresh it after any dependency change in `apps/server/package.json`, including dev dependencies.

## Scripts With Consequences

`scripts` contains reporting jobs, migrations, real-email senders, and production mutations. Set up credentials and read the warnings in [`scripts/README.md`](scripts/README.md) before running one.

```bash
npm --workspace server run script:dev
npm --workspace server run script:prod
```

These run through `tsx` without type checking and connect to the named real Firebase project.

Firebase deploys `apps/server` as the Functions source. `dist/index.js` is its Node 22 CommonJS entrypoint; `@fizz-kidz/core` is bundled there while normal server dependencies are installed from the package manifest and lockfile.
