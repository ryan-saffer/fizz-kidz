# Homepage image and tracking follow-up

This follows the [website-wide audit](2026-09-14-lighthouse.md). The changes defer Google Tag Manager and reduce the homepage hero image download while preserving the existing design.

## Measured results

Three paired mobile runs of fresh before/after production builds, followed by one desktop pair. Lighthouse 13.4.1 used applied DevTools throttling, matching the earlier audit's comparison method. All tracking requests remained enabled during scoring. Results are local lab measurements, not deployed PageSpeed Insights scores.

| Homepage measure                      | Before        | After         |
| ------------------------------------- | ------------- | ------------- |
| Mobile performance, median            | 78            | 96            |
| Individual mobile performance runs    | 78, 77, 83    | 95, 96, 96    |
| Mobile LCP, median                    | 5.44s         | 2.38s         |
| Mobile FCP, median                    | 1.59s         | 1.55s         |
| Mobile Total Blocking Time, median    | 141ms         | 137ms         |
| Hero image file at the mobile profile | 276,818 bytes | 131,005 bytes |
| Desktop performance                   | 100           | 100           |
| Accessibility                         | 96            | 96            |
| Best practices                        | 77            | 77            |
| SEO                                   | 100           | 100           |

The mobile hero file is 53% smaller. Every run downloaded exactly one hero candidate and loaded GTM. The after-runs started GTM after the window load event. None of the eight runs logged browser console errors.

Exact settings, timings, image URLs and verification results are in [the measurement JSON](2026-09-14-homepage-optimisation-results.json). Raw Lighthouse reports and screenshots are retained at the local path recorded there.

## Implementation

### Deferred Google Tag Manager

`apps/website/src/layout/google-tag-manager.js` initializes `window.dataLayer` and queues the standard `gtm.js` startup event immediately. It requests the container after window load, using `requestIdleCallback` with a two-second timeout. Browsers without that API use a deferred timer after load. The timeout bounds the idle wait, not the initial page load.

A window-level guard prevents duplicate scheduling when Astro navigates between pages. The existing noscript iframe and Analytics/Ads container configuration remain intact.

Explicit form events stay queued until GTM starts. Very short visits and automatic interactions before its listeners start can be missed, as discussed before implementing this change.

### Responsive AVIF hero

`home-hero-image.ts` supplies a shared AVIF source and its matching preload. The picture element prefers quality-80 AVIF and retains quality-95 WebP as the fallback. Additional widths cover a 550px mobile image at 1x, 1.75x and 2x density, while retaining the full 1332px source for higher-density displays.

Only AVIF is preloaded. Browsers without AVIF support skip that preload and select the WebP fallback. The viewport meta declaration now precedes responsive preloads. This prevents mobile Chrome from choosing a candidate for its default viewport and then downloading another after applying the viewport declaration.

The supplied PNG, crop, displayed size, colours, typography, composition and animation timings are unchanged. The picture wrapper uses `display: contents` so the image keeps its existing absolute-positioning context.

## Verification

- Website production build and Astro checks passed with zero errors, warnings or hints.
- Website formatting, lint and type checks passed.
- Four loader regression tests passed via `npm run test:gtm --workspace website`.
- A browser test confirmed GTM waits for load and idle, preserves queued form events, and executes once when Astro navigates during its pending download. This test used a mocked GTM response and submitted no real form or lead.
- Mobile device emulation at 412px/1.75x and 390px/3x, plus desktop at 1440px/1x, confirmed a single AVIF candidate, matching text and computed styles, and a maximum geometry difference below 0.05 CSS pixels.
- Simulating unsupported AVIF confirmed a single WebP fallback download.
- Visual comparisons retained the artwork's appearance. At 1024px, the AVIF candidate's RGB root-mean-square error against the original PNG was 1.97, versus 3.05 for the quality-95 WebP, composited over the hero blue. This pixel comparison supplements the visual check; it is not a universal perceptual-quality measure.

Animation was frozen and external requests were mocked only for deterministic visual/behaviour checks. Scored Lighthouse runs used normal animation and live tracking requests.

## Remaining gap

The median mobile score is 96, not 100. Remaining first-paint/LCP latency and JavaScript execution still contribute to the score. GTM's Analytics and Ads scripts still execute after loading, and their advertising cookies still affect Best practices. The existing colour-contrast failures still affect Accessibility.

Run the homepage again on Netlify after deployment to measure production delivery. Keep the throttling method consistent within each comparison.
