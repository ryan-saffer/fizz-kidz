# Website

The public face of Fizz Kidz. Mostly Astro pages, with React where interaction earns its keep.

Most copy lives directly in `src/pages` and `src/components`. Sanity supplies the Holiday Program schedule, the birthday-party customer catalogue, and the editable image slots resolved during the Website build.

`src/utils/sanity-api-client.ts` is the Sanity boundary. Its birthday-party query returns the complete published active catalogue, resolves each card's optional image, label, and alt-text overrides against its creation defaults, and validates the result with the runtime-neutral contract from `@fizz-kidz/core`. Generic catalogue cards and package sections live under `src/components/birthday-party-catalogue`. The current birthday-party routes remain on their static components until the imported catalogue drafts have been reviewed and published.

Website forms use the Zod schemas, inferred payload types, and select options exported from `@fizz-kidz/core` in `packages/core/src/website/website-forms.ts`. Submit active forms through `src/utils/website-forms.ts`; it dynamically imports the vanilla tRPC client on first submission, keeping tRPC out of the initial island bundle while preserving end-to-end input, output, and error typing.

## Less Static Than It Looks

- `src/pages/api/uploadthing.ts` handles uploads.
- Location pages load Google reviews.
- Instagram data uses Netlify credentials and storage.
- `netlify/functions/weekly-scheduled-build.ts` refreshes external content every week.

## Work On It

```bash
npm run website
npm run website:local
npm run website:prod
npm --workspace website run check
npm run build --workspace website
npm --workspace website run build:dev
npm --workspace website run preview
```

`npm run website` sends API requests to `https://dev.fizzkidz.com.au`; `npm run website:local` sends them to the development Functions emulator on port `5001`; and `npm run website:prod` sends them to `https://bookings.fizzkidz.com.au`. Start `npm run server` or `npm run portal:local` alongside `website:local` so the emulator is available.

Local environment values live in `apps/website/.env`:

- `PUBLIC_UPLOADTHING_TOKEN`
- `NETLIFY_TOKEN`

Production and preview values live in Netlify.

## SEO Data

`src/utils/seo.ts` builds the shared Schema.org graph and route-specific service, breadcrumb, location and studio-list entities. Keep public studio names and addresses in `src/utils/studios.ts`; location pages, the footer, structured data and `public/llms.txt` should agree with that source.

> **Deployment:** Deploys from `main` and `develop` run through GitHub Actions. The pipeline publishes changed Firebase targets first and only then triggers a cached Netlify build when Website code changed, so a Firebase failure skips Netlify. `main` publishes production; `develop` publishes a branch deploy built in development mode. Netlify still owns pull-request previews and other branch deploys; automatic Git-backed builds from `main` and `develop` are ignored. GitHub's `dev` and `prod` environments require `NETLIFY_AUTH_TOKEN` and their branch-specific `NETLIFY_BUILD_HOOK_URL` secrets plus the `NETLIFY_SITE_ID` variable.

Netlify hosts the Astro output and `apps/website/netlify/functions`. Remote image optimization allows Sanity and Instagram CDN hosts.
