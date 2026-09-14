# Website

The public face of Fizz Kidz. Mostly Astro pages, with React where interaction earns its keep.

Most copy lives directly in `src/pages` and `src/components`. Sanity supplies the Holiday Program schedule, birthday-party catalogue and package pages, and the editable image slots resolved during the Website build.

The homepage's approved collage hero, lifecycle-aware typewriter and service-first "Find your fizz" cards live in [`src/components/home`](src/components/home/README.md). `src/pages/index.astro` composes this introduction with the existing homepage sections. The Polaroid uses the Sanity Website image key `home-polaroid`.

`Layout.astro` exposes a `head` slot for page-specific resource hints and preloads the shared WOFF2 Lilita font on every page. Party theme cards declare their responsive display width so the browser can download a suitably sized image.

Below-fold FAQs, incursion modules and the deep Franchising/Gift Cards forms render their HTML on the server and hydrate within 300px of the viewport. Studio galleries hydrate when visible. Keep the navigation and immediately needed forms available on their existing hydration schedule.

The locations overview uses `src/components/locations` for its photo-collage layout and studio explorer. The explorer loads Leaflet when it approaches the viewport, uses OpenStreetMap tiles with attribution, and shares studio selection between the directory, branded pins and photo preview. It needs no map API key. Overview coordinates in `src/utils/studios.ts` come from the individual studio map embeds; Google Maps directions use the full street address. Studio links work without JavaScript or map tiles. The custom element cleans up its map, observers and listeners on Astro navigation, and respects reduced motion for pin entrances and map movement.

Import Leaflet's CSS in `studio-explorer.astro`, not its client script. Astro restores component styles on back navigation; a script-only CSS import disappears after leaving the page because the script executes once. Without those styles the map panes enter normal document flow and the resize observer repeatedly expands the page. When changing the explorer, navigate to a studio and back several times, checking that all seven pins remain usable and the page height stays stable. Pins, directory dots and map connectors share `--studio-colour`; the selected pin uses a lavender fill and purple label.

`src/utils/sanity-api-client.ts` is the Sanity boundary. Its birthday-party query returns the complete published active catalogue, resolves image and card overrides, and validates the result with the runtime-neutral contract from `@fizz-kidz/core`. Generic package rendering lives under `src/components/birthday-party-catalogue`; `src/pages/birthday-parties/[slug].astro` generates one static route per active package. The same package data supplies the birthday-party menu, breadcrumbs, Party Themes, all-creations page, hero, SEO, and optional feature sections. Menu, Party Themes, creations-heading, and creations-image labels are derived from the canonical package name. The package primary colour drives its introduction; its accent colour drives Party Themes and the all-creations heading. The package's New setting renders badges in the menu and as Website overlays on the Party Themes and creations-section images, so Sanity images must not contain baked-in badges. At Home remains a dedicated static page.

Publishing an active package triggers the existing Netlify build webhook. A successful build adds its route to the site and sitemap and includes it in the menu, Party Themes, and creations. Retiring a package removes those surfaces on the next successful build. Published packages therefore need complete Website-page data, a unique package position, and a permanent non-reserved slug; malformed data fails the Website build rather than producing a partial page.

Website forms use the Zod schemas, inferred payload types, and select options exported from `@fizz-kidz/core` in `packages/core/src/website/website-forms.ts`. Submit active forms through `src/utils/website-forms.ts`; it dynamically imports the vanilla tRPC client on first submission, keeping tRPC out of the initial island bundle while preserving end-to-end input, output, and error typing.

## Google Tag Manager

`src/layout/google-tag-manager.js` is embedded inline by `Layout.astro`. It creates `window.dataLayer` immediately so form events can queue, then requests GTM after the window's `load` event and an idle callback. The idle callback has a two-second timeout; browsers without that API use a deferred timer after load. A window-level guard prevents duplicate scheduling across Astro navigation, including navigation while the download is pending.

Very short visits and automatic interactions before GTM starts can be missed. Explicit `dataLayer` events stay queued. This changes loading order, not the container's Analytics or Ads configuration. Run the loader tests with `npm run test:gtm --workspace website`.

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

## Lighthouse audits

Run the sitemap-wide mobile and desktop audit against a production or preview URL:

```bash
node apps/website/scripts/lighthouse-audit.mjs https://www.fizzkidz.com.au /path/to/reports
```

Append route paths to audit a subset. The script uses Lighthouse 13.4.1 through npm, saves full JSON reports, and runs sequentially through one isolated browser. It defaults to `$HOME/.local/bin/chrome-headless`; `CHROME_PATH` can point to another dedicated automation browser. Keep other browser audits and builds idle while measuring performance. Analytics and third-party requests stay enabled.

The default throttling method is Lighthouse's `simulate`. Set `LIGHTHOUSE_THROTTLING_METHOD=devtools` to apply the network and CPU limits during loading. Use the same method for both sides of a comparison. Applied throttling avoids the font/first-paint modelling artefact observed when auditing these builds on an unthrottled localhost server.

The [September 2026 audit](../../docs/audits/2026-09-14-lighthouse.md) records the scores, appearance-preserving fixes and remaining gaps.

The [homepage follow-up](../../docs/audits/2026-09-14-homepage-optimisation.md) measures deferred GTM loading and the responsive AVIF hero with three paired mobile runs.

## SEO Data

`src/utils/seo.ts` builds the shared Schema.org graph and route-specific service, breadcrumb, location and studio-list entities. Keep public studio names and addresses in `src/utils/studios.ts`; location pages, the footer, structured data and `public/llms.txt` should agree with that source.

> **Deployment:** Deploys from `main` and `develop` run through GitHub Actions. The pipeline publishes changed Firebase targets first and only then triggers a cached Netlify build when Website code changed, so a Firebase failure skips Netlify. `main` publishes production; `develop` publishes a branch deploy built in development mode. Netlify still owns pull-request previews and other branch deploys; automatic Git-backed builds from `main` and `develop` are ignored. GitHub's `dev` and `prod` environments require `NETLIFY_AUTH_TOKEN` and their branch-specific `NETLIFY_BUILD_HOOK_URL` secrets plus the `NETLIFY_SITE_ID` variable.

Netlify hosts the Astro output and `apps/website/netlify/functions`. Remote image optimization allows Sanity and Instagram CDN hosts.
