# Portal

The working heart of Fizz Kidz: staff operations, bookings, enrolments, forms, and a handful of public customer journeys.

React 19, React Router, tRPC, Firebase Auth, and an evolving mix of UI systems. New work should favour shadcn/ui, Tailwind, and Zustand; MUI and Ant Design are the old world.

## Find Your Way Around

- `src/index.tsx` mounts the app.
- `src/app.tsx` is the route map.
- `src/components/root/root.tsx` wires tRPC, auth, organization, query, theme, localization, and dialogs.
- `src/components/root/dashboard-layout.tsx` is the staff dashboard shell.
- `src/components/Session` owns auth and organization access.
- `src/ui-components/ui` contains shadcn/ui components.
- `src/components` contains the actual features.

Most pages are lazy-loaded. `/dashboard/**` is staff-only; booking, enrolment, form, and invitation routes may be public.

## Server Connection

The Portal batches tRPC requests through `/api/trpc`. The client is created in `root.tsx`; `src/utilities/trpc.ts` connects it to the server's `AppRouter` type.

`npm run portal:local` only starts the Portal and routes its tRPC and callable Functions through an already-running local Functions emulator. Auth, Firestore, and Storage remain connected to the development Firebase project.

`npm run portal:prod-local` uses production Auth, Firestore, and Storage while routing tRPC and callable Functions through an already-running production-configured local Functions emulator. Run `npm run server:prod` separately.

`@fizz-kidz/core` resolves straight to `packages/core/src`, so shared changes appear without a package build.

Birthday Party and Holiday Program creation instructions come from Sanity through server tRPC endpoints. Their Portable Text renderer lives in `@fizz-kidz/ui` and is shared with the Sanity Studio preview.

## Run It

```bash
npm run portal          # Development Firebase + deployed development backend
npm run portal:prod     # Production Firebase + deployed production backend
npm run portal:local    # Development Firebase + local development server
npm run portal:prod-local # Production Firebase + local production server
npm run dev             # Portal in local mode + local server stack
vp test --run --project portal
```

> **Remember**
>
> - `portal:prod` talks to real production services.
> - `portal:prod-local` runs local server code against real production services and data.
> - `/invite/**` uses the separate `invitation.html` build entry.
> - Backend-owned paths such as `/forms/**` must match Express, Firebase Hosting, and the Vite proxy.
> - Development uses `apps/portal/.env`; production mode also loads `.env.prod`.

`npm run build` writes the Portal to `apps/portal/dist`. Firebase Hosting serves it and falls back to `index.html` for normal SPA routes.
