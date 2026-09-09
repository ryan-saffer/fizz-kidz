# Website

The public face of Fizz Kidz. Mostly Astro pages, with React where interaction earns its keep.

Most copy lives directly in `src/pages` and `src/components`. Sanity supplies the Holiday Program schedule, birthday-party catalogue and package pages, and the editable image slots resolved during the Website build.

The homepage's approved collage hero, lifecycle-aware typewriter and service-first "Find your fizz" cards live in [`src/components/home`](src/components/home/README.md). `src/pages/index.astro` composes this introduction with the existing homepage sections. The Polaroid uses the Sanity Website image key `home-polaroid`.

`Layout.astro` exposes a `head` slot for page-specific resource hints. The homepage uses it to preload Lilita for the typewriter's first render.

`src/utils/sanity-api-client.ts` is the Sanity boundary. Its birthday-party query returns the complete published active catalogue, resolves image and card overrides, and validates the result with the runtime-neutral contract from `@fizz-kidz/core`. Generic package rendering lives under `src/components/birthday-party-catalogue`; `src/pages/birthday-parties/[slug].astro` generates one static route per active package. The same package data supplies the birthday-party menu, breadcrumbs, Party Themes, all-creations page, hero, SEO, and optional feature sections. Menu, Party Themes, creations-heading, and creations-image labels are derived from the canonical package name. The package primary colour drives its introduction; its accent colour drives Party Themes and the all-creations heading. The package's New setting renders badges in the menu and as Website overlays on the Party Themes and creations-section images, so Sanity images must not contain baked-in badges. At Home remains a dedicated static page.

Publishing an active package triggers the existing Netlify build webhook. A successful build adds its route to the site and sitemap and includes it in the menu, Party Themes, and creations. Retiring a package removes those surfaces on the next successful build. Published packages therefore need complete Website-page data, a unique package position, and a permanent non-reserved slug; malformed data fails the Website build rather than producing a partial page.

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
