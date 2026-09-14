# Website Lighthouse audit

14 September 2026. The target was the public Fizz Kidz website, with its visual design preserved.

## Results

The final paired sweep completed all 148 audits successfully.

| Measure                                     | Before                            | After |
| ------------------------------------------- | --------------------------------- | ----- |
| Mobile performance, median across 37 pages  | 97                                | 97    |
| Homepage mobile performance                 | 72                                | 81    |
| Homepage mobile LCP                         | 7.0s                              | 4.5s  |
| Desktop performance, every page             | 100                               | 100   |
| Mobile accessibility, median                | 88                                | 96    |
| Desktop accessibility, median               | 91                                | 96    |
| Accessibility, every page after the changes | 85 to 96 depending on page/device | 96    |
| Best practices, median                      | 73                                | 77    |
| SEO, every page                             | 100                               | 100   |

Performance was already strong outside the homepage. The site-wide mobile median did not change; individual one- or two-point movements are within normal measurement noise. The largest measured performance improvement was the homepage. Every page now passes all scored accessibility checks except colour contrast.

Best practices is 77 in most after-runs. Careers scores 73 because the local server lacks its upload endpoint. The K-Pop Power mobile run also scores 73 because two Google tag downloads failed with `ERR_CONNECTION_CLOSED`. Its performance score of 99 is not evidence of an improvement, since those scripts did not execute. Both exceptions are retained in the score table.

Malvern is a remaining performance regression in the local test. It scored 98 → 93 in the full sweep and 97 → 93 in a focused repeat. Its unchanged 90 KB hero image took about a second longer to finish downloading. Removing the font preload in an isolated experiment only recovered one point. This needs a targeted request-priority and third-party-contention check on Netlify before claiming a performance improvement for that page. The original result remains in the table.

The [score matrix](2026-09-14-lighthouse-scores.md) contains every page's before/after scores for mobile and desktop. The [measurement data](2026-09-14-lighthouse-results.json) records scores, timings, browser settings, failed audits and source-report hashes.

These changes are in the worktree. The production site has not been deployed with them. The live-site sample in the matrix is a baseline, not a claim about deployed improvements.

## Scope and method

- All 37 canonical pages in the website sitemap, including all 11 published party-package pages and all seven studios.
- Four categories on both mobile and desktop: Performance, Accessibility, Best practices and SEO.
- Lighthouse 13.4.1, Chrome for Testing 152.0.7977.82, the default mobile/desktop profiles with network and CPU throttling applied through DevTools during loading.
- Sequential cold-navigation audits through an isolated browser, with each before-run immediately followed by its matching after-run. Google Tag Manager, Analytics, Google Ads and embedded services remained enabled during scoring.
- Matched production builds of the original source at `b710af282c79f9f27ec95bfe0ab50c808638cf94` and the modified worktree. Both use the published CMS content resolved at build time.
- Local static HTTP serving, with gzip for HTML, CSS, JavaScript and original TTF/OTF fonts, plus immutable caching for hashed assets. WOFF2 files are already compressed.
- Additional live production checks of the homepage, Slime Parties, Balwyn and Careers using Lighthouse's default simulated throttling. These are labelled separately and are not directly comparable with the applied-throttling table.

Each full-sitemap cell is one run, not a multi-run median. Network timing, tag responses and local CPU scheduling introduce noise. Small score differences should not be treated as a proven improvement or regression. Repeat the audit against a Netlify preview and production after deployment to measure the hosting path too.

The first exploratory local pass did not compress the original font files. I repeated the baseline with font compression before producing the comparison table. Netlify already compresses the original fonts, so comparing raw font transfer against WOFF2 would exaggerate the production benefit.

### Why applied throttling

Default Lighthouse simulation produced a misleading local comparison after font compression. Slime Parties actually painted in 41ms versus 52ms on the unthrottled local connection, but the simulator extrapolated a slower page. Removing preload hints and changing stylesheet delivery did not resolve that discrepancy.

The trace explains the mismatch. The original Gotham requests finished just after the first paint; the smaller WOFF2 requests finished before it. Lighthouse's paint simulation includes very-high-priority requests that finish before the observed paint, so faster local delivery changed which fonts entered its blocking-request model. This behaviour appears in the bundled trace engine's `getFirstPaintBasedGraph` and `hasRenderBlockingPriority` methods.

[Lighthouse's throttling documentation](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) describes these simulation edge cases. Applied DevTools throttling is also an approximation, not a field measurement or a guarantee of PageSpeed Insights results. It avoids extrapolating from the unusually fast font arrival order in this particular localhost comparison.

I checked the same builds with network and CPU limits applied during loading. Slime Parties scored 97 before and after; its Total Blocking Time fell from 186ms to 159ms. The homepage improved from 76 to 81, and LCP fell from 6.1s to 4.5s. The final full-sitemap table therefore uses applied throttling for both builds. These diagnostic runs are additional to that table.

For transparency, the default simulated local homepage result was 84 → 73 and Slime Parties was 94 → 85. Those results remain in the measurement JSON. They are not evidence that the production site's scores increased. The production defaults must be rechecked after deployment.

The local server does not execute `/api/uploadthing`. Careers therefore logs a local-only 404 from that endpoint. Both live Careers audits passed the console-error check. This is a limitation of the local test server, not an application defect introduced by these changes.

Redirects, the intentional 404 page, the noindex form-result page and API endpoints are outside the canonical-page score matrix. Customer journeys hosted on `bookings.fizzkidz.com.au` belong to the Portal and were not part of this website audit.

## Changes made

### Font delivery

Converted the existing Gotham, Lilita One and Permanent Marker files to lossless WOFF2. All font files together fell from **778,460 bytes to 237,756 bytes**, a 69.5% reduction on disk. This is not a 69.5% reduction in production network traffic, since Netlify already compressed the original files in transit.

The glyphs, character coverage, font weights and metrics remain the same. The original font files remain the conversion sources. The shared brand stylesheet now loads WOFF2, and the website preloads the matching Lilita file on every page. The shared stylesheet also supplies Portal and Studio typography.

Files: `packages/ui/src/brand-fonts.css`, `packages/ui/src/assets/fonts/`, `packages/ui/package.json`, `apps/website/src/components/home/home-intro.css` and `apps/website/src/layout/Layout.astro`.

### Rendering and images

- Preload the homepage's responsive hero image from the document head. The preload and visible image share their source-selection settings in `home-hero-image.ts`.
- Correct the party-theme grid's image `sizes` attribute. Browsers can select an image for the actual two- or four-column card width, rather than assuming a full-width image.
- Correct the header logo's malformed `sizes` values.
- Lazy-load the below-fold YouTube iframe on the in-schools after-school page.
- Hydrate below-fold FAQs, incursion modules and the deep Franchising/Gift Cards forms when they approach within 300px of the viewport. Studio galleries hydrate when visible. Their HTML still renders on the server; the browser downloads their interactive code when it is needed.

Image quality settings, the hero's source resolution, cropping, aspect ratios, imagery and animation timings remain as designed. An attempted global `sizes="auto"` change altered intrinsic sizing in flex layouts. I removed it after the visual comparison caught that change.

I also tested inlining every stylesheet. It did not produce a reliable mobile improvement, so it is not part of the final changes. Separate stylesheets retain cross-page caching and keep the initial HTML smaller.

### Accessibility semantics

- Give the home/logo link an accessible name when the image is hidden on narrow screens.
- Give review-star groups an image role so their existing accessible labels are valid.
- Add descriptive titles to six studio map iframes. Werribee already had one.
- Correct skipped heading levels in shared party sections and affected program, studio, team and events pages. The existing classes preserve their appearance.
- Add main landmarks to Franchising and Preschool Program.

These fixes improve the information available to screen readers without changing the visible content.

### Document structure and script errors

- Move the UTF-8 declaration to the start of the head and place scripts inside the document structure. Production already declares UTF-8 through HTTP; the HTML now stands on its own too.
- Put the loading indicator inside the body and title the GTM noscript iframe.
- Run the Franchising header-shadow handler after parsing the document. It previously accessed `document.body` while it was still null.
- Register fragment scrolling through a processed script and look up the target by ID. This avoids treating the URL fragment as a CSS selector and avoids repeatedly registering the same inline listener during Astro navigation.

## What closes the remaining gap

### Accessibility: visual contrast decisions

The colour combinations below fail Lighthouse's contrast audit. They cannot be fixed by adding labels or changing HTML headings.

| Example                                                            | Measured contrast | Required contrast               | What would have to change                |
| ------------------------------------------------------------------ | ----------------- | ------------------------------- | ---------------------------------------- |
| White text on gold primary buttons, `#ffffff` on `#f6ba33`         | 1.75:1            | 4.5:1 for the current 18px text | Darker text or a darker button fill      |
| White homepage contact-button text on blue, `#ffffff` on `#4cc5d9` | 2.03:1            | 4.5:1                           | Text or background colour                |
| White review rating on cyan, `#ffffff` on `#5fd7ef`                | 1.68:1            | 3:1 for the current 24px text   | Rating text or badge fill                |
| Green creation labels on white, `#4ee16c` on `#ffffff`             | 1.70:1            | 3:1 for the current 24px text   | Label colour                             |
| Blue section headings on white, `#4dc5da` on `#ffffff`             | 2.03:1            | 3:1                             | Heading colour                           |
| Review dates over the pink decoration, `#64748b` on `#fce7f3`      | 4.04:1            | 4.5:1                           | Date colour, decoration or their overlap |

The measurement JSON includes the remaining reported elements and affected routes. Other recurring examples include theme-card captions, light-coloured section copy and white text on coloured panels.

WCAG AA requires at least 4.5:1 for ordinary text, or 3:1 for large text. Making text sufficiently large or bold is another route, but it would also change the UI. Check hover and focus states when updating the palette.

Lighthouse also reports some homepage text against the bounding box of a clipped decorative blob. Confirm the actual painted background before changing those particular colours. That possible automated false positive does not explain the genuine gold-button, cyan-badge and coloured-text failures above.

### Best practices: advertising cookies and browser issues

Two recurring scored checks fail because of third-party advertising requests:

- `third-party-cookies`, including Google's `IDE` and `test_cookie` cookies.
- `inspector-issues`, reporting the associated browser cookie issues.

The current container, `GTM-NBCZ5XHQ`, loads Analytics `G-9T888DDK2Y` and Google Ads destinations `AW-860744546` and `AW-17921698875`.

To reach 100, the page must stop producing the offending cookie requests and browser issues under the tested browser. Review which Ads destinations and remarketing features are required, remove obsolete tags, and validate any cookie-free measurement configuration with real conversion journeys. Removing one duplicate destination alone would not clear the audit if another tag still sets third-party cookies. Server-side tagging alone is not a guarantee either.

I kept the measurement setup intact. Delaying or blocking those requests just for Lighthouse would conceal the problem, and changing ad attribution requires a business decision even though it has no visual effect.

### Performance: homepage payload and third-party work

The homepage's largest-contentful-paint element is the girls' hero image. On Lighthouse's mobile profile, the existing source-selection settings choose a 1200px image of about 277 KB. It remains at the approved quality of 95. Further reduction would require an image-encoding or responsive-source change checked against the approved artwork. Lowering quality, reducing the visible artwork or removing animation has not been used to increase the score.

Google Tag Manager plus its Analytics and Ads scripts transfer roughly 650 KB of JavaScript before accounting for the site's own code. Lighthouse reports roughly 270 KB of unused third-party JavaScript on a typical initial navigation. Review unused tags and overlapping destinations first. Scheduling nonessential tags after the first render could also help, but changes when brief visits and conversions are measured.

The site's navigation hydrates React and Radix components on every page. A smaller implementation with the same appearance and keyboard behaviour could reduce first-party JavaScript further. That would require checking dropdowns, mobile navigation, focus management and Astro transitions across devices.

Performance scores come from FCP, LCP, Speed Index, Total Blocking Time and CLS. An "unused CSS" or "image savings" diagnostic is not a separate score deduction. Use those diagnostics to improve the measured timings, rather than treating an empty diagnostics list as the goal.

## Visual and functional verification

Compared full-page renders before and after at 412px and 1440px for the homepage, Slime Parties, Holiday Programs, Balwyn, Franchising, Preschool Program, Incursions and Activations & Events.

All 16 comparisons had identical measured element positions, dimensions, text, typography, spacing and colours. Fourteen screenshots were pixel-identical. The two homepage screenshots differed only in party-card image resampling, with fewer than 0.15% of pixels changing by more than 16 colour levels. No layout or text changes accompanied those image differences.

For these deterministic visual comparisons, animations were frozen, reduced motion was enabled, all images were loaded, and external requests were blocked. Those test controls were used only for visual comparisons. Lighthouse scoring used normal animations and live third-party requests.

Font conversion checks also verified identical glyph order and horizontal metrics between the original and WOFF2 files.

Browser journey checks passed for mobile menu opening/closing, Astro navigation to the contact fragment, deferred FAQ hydration and expansion, the Franchising scroll handler, the homepage without JavaScript, and the hero preload selecting exactly the same image candidate without a duplicate download. These journeys logged no page JavaScript exceptions. No enquiries, bookings or uploads were submitted.

Build and code checks passed:

- `npm run build --workspace website`, including Astro checking with zero errors, warnings or hints.
- `npm run build --workspace @fizz-kidz/ui`.
- `npm exec -- vp check apps/website packages/ui`.
- `git diff --check`.

## Repeat after deployment

The repository includes a repeatable audit runner:

```bash
node apps/website/scripts/lighthouse-audit.mjs \
  https://www.fizzkidz.com.au /path/to/lighthouse-reports
```

Append paths to audit a subset:

```bash
node apps/website/scripts/lighthouse-audit.mjs \
  https://www.fizzkidz.com.au /path/to/lighthouse-reports \
  / /holiday-programs/ /birthday-parties/slime-parties/
```

The runner uses a dedicated automation browser at `$HOME/.local/bin/chrome-headless`, or an explicit `CHROME_PATH`, and downloads the pinned Lighthouse version through npm. It saves full JSON reports and fails on audit runtime errors.

To reproduce the applied-throttling method used in the comparison table, prefix the command with `LIGHTHOUSE_THROTTLING_METHOD=devtools`. The default command uses simulated throttling, as used by the live-site sample. Keep methods consistent within each comparison.

After deploying, run all 37 routes again and take at least three mobile runs of the homepage and any low-scoring page. Use their median for a release comparison. Check real-user Core Web Vitals separately; Lighthouse is a lab measurement, not field data.

Full raw reports, visual comparisons and build logs from this session are retained locally under `/private/var/folders/_7/gtqk0sq97mlc8h8zdmknfbbc0000gn/T/opencode/lighthouse-audit/`. The score matrix and JSON in `docs/audits/` preserve the results independently of those temporary files.
