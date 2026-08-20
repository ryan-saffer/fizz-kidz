# Fizz Kidz

The software behind Fizz Kidz: the public website, staff tools, customer booking flows, backend services, and internal knowledge base.

It is one npm workspace powered by [Vite+](https://viteplus.dev/), with deployable apps in `apps/` and shared code in `packages/`.

## The Map

| Workspace                                            | What it is                              | Ships to                   |
| ---------------------------------------------------- | --------------------------------------- | -------------------------- |
| [`apps/portal`](apps/portal/README.md)               | Staff portal and customer booking flows | Firebase Hosting           |
| [`apps/server`](apps/server/README.md)               | APIs, webhooks, jobs, and integrations  | Firebase Functions         |
| [`apps/website`](apps/website/README.md)             | Public marketing website                | Netlify                    |
| [`apps/docs`](apps/docs/README.md)                   | Staff and franchisee knowledge base     | Netlify                    |
| [`apps/sanity-studio`](apps/sanity-studio/README.md) | Structured content studio               | Sanity                     |
| [`packages/core`](packages/core/README.md)           | Runtime-neutral shared code             | Bundled into its consumers |
| [`packages/ui`](packages/ui/README.md)               | Shared React presentation               | Bundled into its consumers |

> **Two kinds of docs:** `apps/docs` is the published knowledge base. Root [`docs/`](docs/README.md) is a notebook for engineering plans and design work.

## The Mental Model

- The Portal and public website call the server through tRPC at `/api/trpc`.
- The server exports one Express function (`api`) and one background dispatcher (`pubsub`).
- Portal, server, and website import `@fizz-kidz/core` directly from source. No publish step is involved.
- Website and docs are independent Astro apps. They do not start with the Firebase stack.
- Firebase deploys from GitHub Actions; the Astro apps deploy through separate Netlify sites.

## Get Running

Requires Node `22.23.2`, npm `11.6.2`, and Vite+.

```bash
curl -fsSL https://vite.plus | bash
vp install
vp config
npm run dev
```

`npm run dev` starts the Portal at `localhost:3000`, points it at the local server, and starts the server watchers and Functions/Pub/Sub emulators.

### Commands Worth Remembering

```bash
npm run portal          # Development Firebase and deployed development backend
npm run portal:prod     # Production Firebase and deployed production backend
npm run portal:local    # Development Firebase and local development server
npm run portal:prod-local # Production Firebase and local production server
npm run server          # Local server against development Firebase
npm run server:prod     # Local server against production Firebase
npm run website         # Public site on :4321 against development
npm run website:local   # Public site on :4321 against local server
npm run website:prod    # Public site on :4321 against production
npm run docs            # Knowledge base on :4321
npm run sanity          # Sanity Studio

npm run check           # Read-only format, lint, and type checks
npm run test            # Core, Portal, and server tests
npm run verify          # Fix checks, then test
npm run verify:full     # Include Astro and Sanity checks
npm run build           # Core + server + Portal
```

Build an independent app with `npm run build --workspace website`, `npm run build --workspace docs`, or `npm run build --workspace sanity-studio`.

## Where Shared Code Goes

Put runtime-neutral types and pure logic in `@fizz-kidz/core`, then export them from `packages/core/src/index.ts`. Website form schemas and select options live in `packages/core/src/website/website-forms.ts`, where both the website and server consume the same runtime contracts.

Keep SDK clients, credentials, Firestore, and other runtime-specific I/O in the app that owns them. Shared React presentation belongs in `@fizz-kidz/ui`; runtime-neutral data contracts and pure logic remain in core.

Inside the server, `app` composes deployable HTTP, tRPC, and background adapters; `features` owns business workflows; `integrations` owns provider and runtime I/O; and `shared` holds narrow server-wide helpers. Dependencies flow from app adapters through features and integrations toward shared leaf modules.

Inside the Portal, `app` composes routes and the dashboard shell; `features` owns user journeys; `integrations` owns browser SDK and transport boundaries; `session` owns auth and organization access; and `shared` contains reusable UI and pure helpers.

Add dependencies from the root:

```bash
vp add <package> --filter portal
vp add <package> --filter @fizz-kidz/core
```

## Shipping

- `develop` builds affected targets, deploys changed Firebase targets, then triggers a cached Netlify branch deploy when Website code changed. Sanity changes are validated and built but do not overwrite the production Studio.
- `main` builds and deploys only changed production targets. Firebase deploys first, Sanity deploys when affected, then GitHub Actions triggers a cached Netlify production build when Website code changed.
- A failed Firebase deployment prevents the Website deployment from running.
- Portal watches `apps/portal`, `packages/core`, and `packages/ui`; server watches `apps/server` and `packages/core`; Website and Sanity Studio watch their own apps plus `packages/core` and `packages/ui`.
- Manual production runs deploy Portal, server, Sanity Studio, and Website as a full recovery deployment. Manual development runs deploy only Firebase targets.
- The `dev` and `prod` GitHub environments require the `NETLIFY_AUTH_TOKEN` and `NETLIFY_BUILD_HOOK_URL` secrets plus the `NETLIFY_SITE_ID` variable. Use the `develop` hook in `dev` and the `main` hook in `prod`.
- The `prod` GitHub environment also requires a `SANITY_AUTH_TOKEN` deploy-token secret for `fizz-kidz.sanity.studio`.
- GitHub failure email is configured per account under **Settings > Notifications > System > Actions**; enable email delivery and failed-workflow notifications.
- Netlify still owns pull-request previews, other branch deploys, scheduled builds, and docs deployments.
- GitHub receives Firebase environment files through `PORTAL_ENV_FILE` and `SERVER_ENV_FILE` environment variables.

> **Easy to forget**
>
> - `npm run build` does not build the Astro apps or Sanity Studio.
> - Website and docs both default to port `4321`.
> - Server manifest changes also require refreshing `apps/server/package-lock.json`.
> - Backend-owned browser routes must agree in Express, `firebase.json`, and the root Vite proxy.
> - Netlify's Website ignore rule watches all of `packages/core` and `packages/ui` so shared package changes cannot skip a Website build.

## Useful Starting Points

- Portal routes: `apps/portal/src/app/router.tsx`
- Portal providers and tRPC client: `apps/portal/src/app/root/root.tsx`
- Server HTTP composition: `apps/server/src/app/http/app.ts`
- Server tRPC composition: `apps/server/src/app/trpc/app.trpc.ts`
- Background jobs: `apps/server/src/app/background/function.ts`
- Shared exports: `packages/core/src/index.ts`
- Firestore boundary: [`apps/server/src/integrations/firebase/README.md`](apps/server/src/integrations/firebase/README.md)
- Operational scripts: [`apps/server/scripts/README.md`](apps/server/scripts/README.md)
