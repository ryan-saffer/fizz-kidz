# Homepage introduction

`home-intro.astro` renders the approved option 09 hero on `/`. `home-services.astro` owns the six service cards and their descriptions; `home-decal.astro` owns the decorative SVG artwork. `home-intro.css` scopes the introduction's styles and responsive layout. The rest of the homepage is composed in `pages/index.astro`, using the shared site navigation and footer from `Layout.astro`.

The hero uses blue `#4CC5D9`, pink `#E91571`, yellow `#FDDC5D`, green `#50B47E` and the existing purple. Both supporting paragraphs use deep navy for contrast; the pink shape stays above the copy on mobile. The girls are the supplied `assets/images/pages/home/girls-masked.png`. The Polaroid is the published Sanity Website image with key `home-polaroid`, resolved through `data/website-images.ts`. Both use the existing responsive Image component. Permanent Marker is self-hosted under `assets/fonts/permanent-marker`, with its Apache 2.0 license.

## Animation

`home-typewriter.ts` is a custom element with per-mount timers and observers. Its words are configured on `home-typewriter` in the Astro component: `create → explore → celebrate → fizz!`, coloured purple, green, blue and pink respectively. The gold sweep replaces the final word's pink. Typing takes 135ms per character, backspacing 75ms, with an 800ms word hold and a 200ms pause before the gold finish.

The server renders a pending state with only "let's" and a purple cursor visible, preventing a flash of the finished gold word before typing. The homepage preloads the shared Lilita font through the layout's `head` slot. Startup waits only for Lilita, not `document.fonts.ready`, decorative fonts or React hydration. Once ready and visible, a 650ms opening beat blinks the cursor once before typing. Each completed non-final word also gets one cursor blink during its hold, before backspacing. The cursor disappears in the same update that types the final exclamation mark; the 200ms pause before the gold sweep remains. A hidden static word is revealed by CSS for reduced motion and by a noscript fallback when JavaScript is disabled.

The single-line headline reserves space for the longest word. Its backing shrinks at the finish and reveals the atom. Gold sweeps across `fizz!` over 850ms, glows once for 1.1 seconds, then a brighter, crisp highlight shimmers across the letters over 3.8 seconds. There is no persistent blurred outline. Animation-end events advance the finish stages. The animation pauses when the heading is off screen.

The custom element cleans up timers and listeners on disconnection and initializes again when Astro returns to the homepage. Font loading and resizing fit the entire headline against the longest word. "Let's" and the changing word always share one font size, including on narrow screens, and do not shift during typing.

## Services

Hero CTA labels are 14px on desktop and 12px on smaller screens. The desktop hero is 710px tall; the mobile composition is 730px tall. The girls' responsive image uses quality 95 and includes the full source resolution. The Polaroid is 21% wide on desktop, 24% on tablets and 36% on mobile, with matching responsive image sizes. A white wave with a soft lavender edge sits above the entire hero artwork to cut a clean curved boundary into the services. It is 80px high on desktop and 50px on mobile. The Polaroid has a pale outline and soft shadow so its frame stays distinct against that white edge.

"Find your fizz" is centred in purple and pink Lilita, 72px on desktop and 44px on mobile. Cards lead with the service name, followed by a 20px "let's" line and a 16px description. Preschool uses "let's make" and franchising uses "let's grow". Card image areas are taller than the prototype: 190px on desktop, 170px on two-column mobile layouts, and 220px on small screens. Navigation arrows use Lucide ArrowRight.

## Development

Run `npm run website`, then open `http://localhost:4321/`. Check desktop and mobile layouts, no-JavaScript rendering, reduced motion, and navigation away from and back to the homepage when changing the animation.

The prototype route and its support files have been removed. The approved exploration is archived on the local branch `prototype/homepage-header-option-09-2026-09-09`, commit `35f83217ab61b18dff6eceb8132a7c79015c6573`.
