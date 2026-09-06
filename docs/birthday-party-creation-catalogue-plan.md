# Sanity-driven birthday party creation catalogue

## Status

In progress across the catalogue programme. Phases 1 and 2 are implemented locally: Sanity owns the reviewed catalogue and package pages, including live and archived creation keys plus creation-owned studio/mobile availability; the Website builds every catalogue surface from it; and the server and Portal use the same catalogue for booking choices and submission resolution. The Studio and canonical Sanity content are live, but the Website, Portal, and server changes will remain undeployed until the complete coordinated cutover. Paperform automation is deferred and its choices will be updated manually. Final cleanup remains.

## Goal

Make Sanity the source of truth for the birthday party packages and creations shown to customers. Start by moving the public Website catalogue out of Astro files. Later, use the same catalogue for Paperform choices, submission handling, and the Portal booking editor.

The Website is the authority for the initial migration. Its current names, package memberships, order, images, and visible options define what customers have been promised. Every Website-visible creation must remain available in Paperform for each booking channel where it is offered.

## Decisions

- Design the complete catalogue once, then move each consumer to it in phases.
- Phase 1 changes the Website and Sanity Studio. It does not change the live Paperform or booking submission path.
- Preserve Paperform's package-specific Multiple Choice questions. Their option images and layout are part of the customer experience.
- Preserve the existing Sanity-triggered Website rebuild. Creation and package publishes must continue to trigger it.
- Keep customer-facing creations separate from creation instructions. Several themed creations can share one set of instructions, and one creation can use different imagery in different packages.
- Give every creation a stable business key. Let Sanity generate ordinary document `_id` values.
- Archive creations instead of deleting them once a booking or Paperform submission may refer to them.
- Resolve current submissions within their package and channel. If historical package membership no longer exists, resolve an archived key or label only when it identifies exactly one archived creation globally.
- Keep Paperform field IDs and other provider configuration in the server integration, not in Sanity content.
- Store operational studio/mobile availability on the creation. Availability applies consistently in every package and must not be inferred from a Website card.
- Use each package's ordered Website cards as its only creation-membership source. Exactly one card per creation owns package-specific booking order; additional cards are presentation variants.
- Generate package pages from one fixed template. Sanity owns each package's route, SEO, hero, menu entry, Party Themes card, creations image, and optional feature sections; shared pricing, party information, FAQs, reviews, and values remain in Website code.
- Include every active package in Party Themes, including Fairy and Unicorn. Keep At Home as a dedicated static Website page.
- Store one canonical package name. Derive `{Package name} Parties`, `{Package name} Creations`, and `{Package name} Party Package` where those labels are rendered.
- Store one primary colour for the Website introduction and Portal, plus one accent colour for the all-creations heading and Party Themes card. Both fields use one shared supported-colour palette. Keep the Fluid Bears black creations background as a separate presentation setting.
- Store one package position. It controls Portal creation-instruction groups and, for active packages, the Website menu, Party Themes cards, and all-creations catalogue.
- Store whether a package is new as data, but render the New graphic as a Website overlay on Party Themes and creations-section images. Keep the underlying Sanity artwork free of baked-in badges.
- Complete and test the Website, Portal, and server work before one coordinated production cutover. Paperform will be updated manually and is outside the automated migration scope. Remove legacy Sanity fields only after that cutover is verified.

## Remaining legacy state

The cutover keeps these fallbacks until production verification:

- `apps/website/src/components/creation-packages` has 10 package-specific Astro modules.
- `apps/website/src/components/creations` has 61 card modules containing names, images, and colours.
- `packages/core/src/parties/creations.ts` retains the old active and retired creation maps for historical booking and pre-catalogue Paperform values.
- `apps/sanity-studio` retains old package fields for the currently deployed consumers and the Sweet Kitty staff-only instruction package.
- `apps/server/src/integrations/paperforms/paperform.client.ts` maps 20 package/channel fields by Paperform field ID.
- `apps/server/src/features/party-bookings/core/party-form-mapper.ts` resolves submitted values through Sanity, with a temporary package-and-channel mapping for known pre-cutover Paperform drift.
- `apps/portal/src/features/bookings/parties/forms/ExistingBookingForm/index.tsx` reads current creation menus through server tRPC and uses the old map only to label an unknown historical selection.

The catalogues have already drifted. Sanity includes a Sweet Kitty package that the public Website catalogue does not render. The Website also has themed choices such as Taylor Swift lip balm while the matching staff directions are stored as generic Lip Balm creation instructions.

## Domain model

### Creation instructions

The existing Sanity `_type` `birthdayPartyCreation` remains the creation-instructions document. Its stored type does not change.

An instruction document contains:

- Internal instruction name.
- Portable Text instructions.
- Instruction images.

The Portal's existing creation-instruction page continues to read these documents.

### Creation

`birthdayPartyCreationOffering` is the legacy internal schema name for a creation a customer can see and select. Studio and domain documentation call it a creation.

A creation contains:

- `key`: required, unique, stable, and read-only after first publication.
- `name`: the customer-facing default name.
- `status`: `active` or `retired`.
- Operational availability: studio, mobile, or both. Live Jelly Soap and Unicorn Soap are studio-only; every other current creation supports both.
- `creationInstructions`: an optional reference to a `birthdayPartyCreation` instruction document.
- `legacyLabels`: previous Paperform labels that must still resolve to this creation.

A creation's key is stored on new bookings. Names can change without changing booking identity.

### Party package

Continue using `birthdayPartyPackage`, but add one ordered Website-card array rather than changing the existing creation-instruction reference array in place. Once all consumers use the catalogue, deprecate the old instruction field through Sanity's read-only, hidden, and deprecated lifecycle.

Each package contains:

- Stable package key or slug.
- Canonical package name.
- Active or retired status.
- One position shared by Portal creation-instruction groups and the Website menu, Party Themes cards, and all-creations catalogue.
- Primary and accent colours where required by the current design.
- One ordered list of Website cards.
- Website-page data for its permanent slug, SEO, hero, navigation entry, Party Themes card, creations image, and optional package-specific feature sections.

Each Website card contains:

- A reference to the creation it represents.
- Optional package-specific image, alt text, and label overrides plus its colour treatment.
- Booking-menu order when it is the creation's booking card.

Exactly one card per creation has a booking order. Filtering those cards, then applying the referenced creation's availability, derives selectable studio and mobile creations without a second synchronized list. Website array order still preserves both Fluid Bears' six contiguous cards for one creation and Jungle Safari's two non-contiguous Monster Slime cards. Booking order remains independent where needed, such as Fairy's Marshmallow Slime placement. A card defaults to its creation's image and name and stores overrides only where presentation differs.

Every array projection must include its Sanity `_key`.

## Catalogue rules

Sanity validation and automated checks should enforce these rules:

- Active packages have a key, name, Website position, and at least one Website card.
- Live creations have a unique stable key, customer-facing name, and at least one operational booking channel.
- Every creation represented in a package has exactly one card with a unique consecutive booking order.
- Every active Website card resolves an image, useful alt text, and creation reference.
- Active Website entries appear in the corresponding Paperform package question after the manual Paperform update.
- One package may contain multiple cards for a creation, but only one can be its booking card.
- Archived creations remain queryable for historical bookings and old submissions.
- A legacy Paperform label resolves to exactly one creation within its package.
- Publishing a broken reference or ambiguous Paperform label is blocked.

## Shared catalogue shape

Put runtime-neutral catalogue types and pure validation or normalization in `packages/core`. Keep Sanity clients and GROQ in each app that performs I/O.

The Website Sanity adapter exposes one operation for the full published catalogue. The server Sanity adapter exposes a smaller booking catalogue with active packages and all active or retired creations. Portal reads continue through server tRPC rather than adding a browser-to-Sanity dependency.

The normalized result should contain enough data for callers to render packages, build Paperform choices, resolve submissions, and display retired bookings without knowing the Sanity schema.

## Phase 0: inventory and migration preparation

- [x] Export the current Website package order, cards, labels, images, colours, and package memberships into a reviewable matrix.
- [x] Export the current Paperform creation questions, option labels, images, selection limits, conditional logic, and studio/mobile differences.
- [x] Export the current published Sanity packages and creation instructions.
- [x] Match each Website creation to its current booking key and optional Sanity instructions.
- [x] Record discrepancies. Resolve them in favour of the Website for public content.
- [x] Record the current studio/mobile differences in the matrix and carry forward the repeated mobile soap restriction.
- [x] Identify Website cards that are presentation variants rather than separate selectable creations, including the Fluid Bear sequence and Jungle Safari Monster Slime cards.
- [ ] Confirm whether a Paperform Multiple Choice field update through the Standard API preserves its option-image associations.
- [x] Confirm whether Paperform exposes a supported way to set option images from Sanity asset URLs. The Standard API does not expose choice-image updates.

The catalogue inventory is complete. Paperform option-image mutation testing is deferred with Paperform automation.

## Phase 1: Sanity and Website

### Sanity Studio

- [x] Add the customer creation document schema with validation and a useful preview.
- [x] Extend the package schema with one ordered Website-card list that also derives booking choices.
- [x] Keep existing creation-instruction references intact during migration.
- [x] Add Studio structure entries that make packages, customer creations, and instructions easy to distinguish.
- [x] Add a package preview that shows the same creation cards and order as the Website where practical.
- [x] Import Website content as drafts using generated Sanity document IDs and explicit stable creation keys.
- [x] Reuse the Sanity assets behind the current Website image slots where possible.
- [x] Review and publish the imported catalogue only after it matches the Website inventory.
- [x] Add and publish validated Website-page fields for all active packages.
- [x] Split package editing into Core package information and Website tabs, and deduplicate package names, labels, and colour fields.

### Website

- [x] Add one typed GROQ query for the published active party catalogue.
- [x] Add a generic creation-card Astro module.
- [x] Add a generic package-creations Astro module for summary and party-page variants.
- [x] Render `/birthday-parties/creations/` from the catalogue.
- [x] Generate all active package routes from one `[slug].astro` template and the published catalogue.
- [x] Derive package navigation, breadcrumbs, Party Themes, SEO, and sitemap routes from the same package data.
- [x] Preserve current names, order, images, responsive layout, links, and page copy at cutover; include Fairy and Unicorn in Party Themes.
- [ ] Remove obsolete package and creation modules after visual comparison and production verification.
- [x] Confirm package and creation publishes use the existing automatic Website rebuild path.

### Phase 1 acceptance criteria

- The rebuilt Website matches the current production catalogue before editors make any intentional content changes.
- An editor can rename, reorder, add, retire, or replace the image for a creation in an existing package without a code change.
- The all-creations page and each party page read the same package cards.
- A missing required image, invalid reference, duplicate key, or ambiguous legacy label fails validation or the Website build with a useful message.
- The creation-instructions and Portal instruction experience still works.
- Paperform and booking submission behavior is unchanged.

Phase 1 verification completed with the root checks and 507 tests, Website and Studio checks/builds, generated-route and sitemap assertions, rendered HTML parity for all ten package pages, and pixel-identical desktop/mobile hero screenshots against the static build. Static package and creation modules remain temporarily as a production-verification fallback; the ten static route files have been replaced by the dynamic route.

## Phase 2: server catalogue and Portal compatibility

Move the booking system before changing Paperform. This lets the server understand both old and new submissions during the form cutover.

- [x] Add server catalogue reads for live and archived creations.
- [x] Resolve a creation by package plus stable key, current label, or legacy label.
- [x] Change new booking creation fields from a compile-time union to validated stable catalogue keys.
- [x] Keep the old `CREATIONS` map as a temporary fallback for historical Firestore data.
- [x] Update booking display helpers and emails to resolve catalogue names, with a safe fallback for old keys.
- [x] Expose live package creations to the Portal through tRPC.
- [x] Move the Existing Booking form's creation menus from hardcoded constants to the server catalogue.
- [x] Preserve retired selections when editing an old booking, but do not offer them for a new selection.
- [x] Add structured logging for unknown Paperform values rather than silently dropping them.
- [x] Derive active package instruction groups through creation-to-instruction references while retaining Sweet Kitty's staff-only fallback.
- [x] Import deprecated hardcoded creation keys into Sanity as archived creations for historical bookings.

Phase 2 is implemented locally. The server and Portal handle current Paperform labels, future stable keys, renamed labels, channel availability, and previously selected retired or unknown creations. Production remains unchanged until the coordinated cutover.

## Deferred: Paperform automation

Paperform synchronization, CI changes, and Sanity-to-server webhooks are out of scope for this migration. The existing image-backed Multiple Choice fields, duplicated studio/mobile sections, calculations, layout, and conditional logic remain unchanged. Paperform choices will be updated manually from the reviewed Sanity catalogue. The server continues to resolve current and legacy labels during the transition.

The manual update must:

- Build each studio list from live creations offered at studios and each mobile list from live creations offered at mobile parties.
- Preserve every Multiple Choice image, desktop/mobile column count, selection calculation, field ID, and visibility rule.
- Replace the copied mobile Science list with the mobile-capable Science creations.
- Rename Fairy Glitter Slime to Fairy Slime and remove Nutella Slime from studio Slime.
- When Paperform is updated manually, verify every package on desktop and mobile and submit one studio and one mobile test independently of the application cutover.

## Phase 4: cleanup

- [ ] Remove the active `CREATION_PACKAGES`, `CREATION_PACKAGE_DISPLAY_NAMES`, and `ACTIVE_CREATIONS` catalogue after all consumers have moved.
- [ ] Retain the minimum legacy key mapping needed for historical records, or migrate those records before deleting it.
- [ ] Remove old Paperform label-to-key code after the oldest resubmittable form data no longer needs it.
- [ ] Run the creation-availability migration's `--cleanup-cards --apply` mode, then remove stored card-level availability.
- [ ] Run the creation-instruction migration's `--cleanup --apply` mode, then remove stored `recipe` references.
- [ ] Remove the migration-only Portal order after the coordinated production cutover is verified.
- [ ] Migrate Sweet Kitty to the new creation relationships, then remove the migration-only package instruction references.
- [ ] Run the package-field migration's `--cleanup --apply` mode after the compatible Website, server, and Portal code is deployed, then remove the hidden legacy schema fields.
- [ ] Update the Website, Studio, server, Portal, and core READMEs to describe the final ownership model.

## Verification

Automated coverage should include:

- Catalogue normalization and validation tests in core.
- Website query fixtures for reused creations, package-specific presentation, and archived content.
- Website build coverage for missing assets and broken references.
- Server lookup tests for stable keys, current labels, legacy labels, package context, and unknown values.
- Portal tests for active options and retained retired selections.

Manual verification should include:

- Side-by-side desktop and mobile screenshots of every package on the old and new Website builds. Phase 1 verified the hero viewport for all ten routes; complete rendered HTML was compared for the remaining package content.
- Desktop and mobile Paperform checks for every package question after the manual update.
- A test submission containing creations from more than one package.
- Reprocessing an old submission after one option has been renamed.
- Editing a booking whose creation has been retired.

Run the relevant repository checks at the end of each phase. Phase 1 must include `npm run build --workspace website` and `npm run build --workspace sanity-studio`. Server and Portal phases must include their scoped tests and the root checks.

## Relevant code

- Website catalogue page: `apps/website/src/pages/birthday-parties/creations.astro`
- Website package route template: `apps/website/src/pages/birthday-parties/[slug].astro`
- Website package renderers: `apps/website/src/components/birthday-party-catalogue`
- Temporary static fallback modules: `apps/website/src/components/creation-packages` and `apps/website/src/components/creations`
- Website Sanity adapter: `apps/website/src/utils/sanity-api-client.ts`
- Sanity package schema: `apps/sanity-studio/schemaTypes/documents/birthday-party-package.ts`
- Sanity creation-instruction schema: `apps/sanity-studio/schemaTypes/documents/birthday-party-creation.ts`
- Shared hardcoded catalogue: `packages/core/src/parties/creations.ts`
- Server Sanity adapter: `apps/server/src/integrations/sanity/sanity.client.ts`
- Paperform client and field mapping: `apps/server/src/integrations/paperforms/paperform.client.ts`
- Submission mapping: `apps/server/src/features/party-bookings/core/party-form-mapper.ts`
- Portal booking editor: `apps/portal/src/features/bookings/parties/forms/ExistingBookingForm/index.tsx`

## External references

- [Paperform field update endpoint](https://paperform.readme.io/reference/updateformfield)
- [Paperform Multiple Choice option images](https://paperform.co/help/articles/can-multiple-choice-options-have-images/)
- [Sanity schema design guidance](https://www.sanity.io/docs/schema-types)
