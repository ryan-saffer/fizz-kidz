# Sanity-driven birthday party creation catalogue

## Status

In progress. The Phase 0 inventory, shared contract, Studio schemas, migration, drafts, Website query, and generic renderers are complete. The imported drafts still require visual review and publication before the Website routes are cut over.

## Goal

Make Sanity the source of truth for the birthday party packages and creations shown to customers. Start by moving the public Website catalogue out of Astro files. Later, use the same catalogue for Paperform choices, submission handling, and the Portal booking editor.

The Website is the authority for the initial migration. Its current names, package memberships, order, images, and visible options define what customers have been promised. Every Website-visible creation must remain available in Paperform for each booking channel where it is offered.

## Decisions

- Design the complete catalogue once, then move each consumer to it in phases.
- Phase 1 changes the Website and Sanity Studio. It does not change the live Paperform or booking submission path.
- Preserve Paperform's package-specific Multiple Choice questions. Their option images and layout are part of the customer experience.
- Preserve the existing Sanity-triggered Website rebuild. Creation and package publishes must continue to trigger it.
- Keep public creation offerings separate from creation instructions. Several themed customer choices can share one set of instructions, and one creation can use different imagery in different packages.
- Give every offering a stable business key. Let Sanity generate ordinary document `_id` values.
- Retire offerings instead of deleting them once a booking or Paperform submission may refer to them.
- Keep Paperform field IDs and other provider configuration in the server integration, not in Sanity content.
- Treat intentional studio/mobile differences as catalogue data. They must not live only as manual changes inside Paperform.
- Use each package's ordered Website cards as its only creation-membership source. Exactly one card per creation owns booking channels and booking order; additional cards are presentation variants.

## Current state

The same subject is represented differently in several places:

- `apps/website/src/components/creation-packages` has 10 package-specific Astro modules.
- `apps/website/src/components/creations` has 61 card modules containing names, images, and colours.
- `packages/core/src/parties/creations.ts` has 50 active booking keys, package groupings, display names, and a larger retired catalogue.
- `apps/sanity-studio` has published `birthdayPartyPackage` and `birthdayPartyCreation` documents for the staff instruction experience. At the time this plan was written, production held 11 packages and 54 creation instruction documents.
- `apps/server/src/integrations/paperforms/paperform.client.ts` maps 20 package/channel fields by Paperform field ID.
- `apps/server/src/features/party-bookings/core/party-form-mapper.ts` converts submitted display text back to a hardcoded creation key.
- `apps/portal/src/features/bookings/parties/forms/ExistingBookingForm/index.tsx` builds its creation menus from the same hardcoded catalogue.

The catalogues have already drifted. Sanity includes a Sweet Kitty package that the public Website catalogue does not render. The Website also has themed choices such as Taylor Swift lip balm while the matching staff instructions are stored as a generic Lip Balm recipe.

## Domain model

### Creation instructions

The existing Sanity `_type` `birthdayPartyCreation` remains the creation-instructions document. Its stored type does not change.

An instruction document contains:

- Internal instruction name.
- Portable Text instructions.
- Instruction images.

The Portal's existing creation-instruction page continues to read these documents.

### Customer offering

Add a document type, tentatively `birthdayPartyCreationOffering`, for a creation a customer can see and select.

An offering contains:

- `key`: required, unique, stable, and read-only after first publication.
- `name`: the customer-facing default name.
- `status`: `active` or `retired`.
- `recipe`: an optional reference to a `birthdayPartyCreation` instruction document.
- `legacyLabels`: previous Paperform labels that must still resolve to this offering.

An offering's key is stored on new bookings. Names can change without changing booking identity.

### Party package

Continue using `birthdayPartyPackage`, but add one ordered Website-card array rather than changing the existing creation-instruction reference array in place. Once all consumers use the catalogue, deprecate the old instruction field through Sanity's read-only, hidden, and deprecated lifecycle.

Each package contains:

- Stable package key or slug.
- Customer-facing name.
- Active or retired status.
- Display order.
- Package colour or theme where still required by the current design.
- One ordered list of Website cards.

Each Website card contains:

- A reference to the customer offering it represents.
- Optional package-specific image, alt text, and label overrides plus its colour treatment.
- Booking channels and booking-menu order when it is the creation's booking card.

Exactly one card per creation has booking channels. Filtering and sorting those cards by booking order derives the selectable creations without a second synchronized list. Website array order still preserves both Fluid Bears' six contiguous cards for one creation and Jungle Safari's two non-contiguous Monster Slime cards. Booking order remains independent where needed, such as Fairy's Marshmallow Slime placement. A card defaults to its creation's image and name and stores overrides only where presentation differs.

Every array projection must include its Sanity `_key`.

## Catalogue rules

Sanity validation and automated checks should enforce these rules:

- Active packages have a key, name, order, and at least one Website card.
- Active offerings have a unique stable key and customer-facing name.
- Every creation represented in a package has exactly one card with at least one booking channel and a unique consecutive booking order.
- Every active Website card resolves an image, useful alt text, and creation reference.
- Active Website entries appear in the corresponding Paperform package question once the Paperform phase is live.
- One package may contain multiple cards for a creation, but only one can be its booking card.
- Retired offerings remain queryable for historical bookings and old submissions.
- A legacy Paperform label resolves to exactly one offering within its package.
- Publishing a broken reference or ambiguous Paperform label is blocked.

## Shared catalogue shape

Put runtime-neutral catalogue types and pure validation or normalization in `packages/core`. Keep Sanity clients and GROQ in each app that performs I/O.

The Website Sanity adapter should expose one small operation for the full published catalogue. The server Sanity adapter should expose the same normalized result and add lookup operations for active and historical offerings. Portal reads should continue through server tRPC rather than adding a browser-to-Sanity dependency.

The normalized result should contain enough data for callers to render packages, build Paperform choices, resolve submissions, and display retired bookings without knowing the Sanity schema.

## Phase 0: inventory and migration preparation

- [x] Export the current Website package order, cards, labels, images, colours, and package memberships into a reviewable matrix.
- [ ] Export the current Paperform creation questions, option labels, images, selection limits, conditional logic, and studio/mobile differences.
- [x] Export the current published Sanity packages and recipes.
- [x] Match each Website creation to its current booking key and optional Sanity recipe.
- [x] Record discrepancies. Resolve them in favour of the Website for public content.
- [x] Record the current studio/mobile differences in the matrix and carry forward the repeated mobile soap restriction.
- [x] Identify Website cards that are presentation variants rather than separate selectable creations, including the Fluid Bear sequence and Jungle Safari Monster Slime cards.
- [ ] Confirm whether a Paperform Multiple Choice field update through the Standard API preserves its option-image associations.
- [ ] Confirm whether Paperform exposes a supported way to set option images from Sanity asset URLs. The documented field update accepts option strings but does not document image updates.

Phase 0 is complete when every Website card has an explicit destination in the new model and the Paperform image-sync limitation has a tested answer on a safe copy of the form.

## Phase 1: Sanity and Website

### Sanity Studio

- [x] Add the customer offering document schema with validation and a useful preview.
- [x] Extend the package schema with one ordered Website-card list that also derives booking choices.
- [x] Keep existing recipe references intact during migration.
- [x] Add Studio structure entries that make packages, customer offerings, and recipes easy to distinguish.
- [x] Add a package preview that shows the same creation cards and order as the Website where practical.
- [x] Import Website content as drafts using generated Sanity document IDs and explicit stable offering keys.
- [x] Reuse the Sanity assets behind the current Website image slots where possible.
- [ ] Review and publish the imported catalogue only after it matches the Website inventory.

### Website

- [x] Add one typed GROQ query for the published active party catalogue.
- [x] Add a generic creation-card Astro module.
- [x] Add a generic package-creations Astro module for summary and party-page variants.
- [ ] Render `/birthday-parties/creations/` from the catalogue.
- [ ] Render each existing party page's creation section by stable package key.
- [ ] Preserve current names, order, images, responsive layout, links, and page copy at cutover.
- [ ] Remove obsolete package and creation modules after visual comparison and production verification.
- [x] Confirm package and offering publishes use the existing automatic Website rebuild path.

### Phase 1 acceptance criteria

- The rebuilt Website matches the current production catalogue before editors make any intentional content changes.
- An editor can rename, reorder, add, retire, or replace the image for a creation in an existing package without a code change.
- The all-creations page and each party page read the same package cards.
- A missing required image, invalid reference, duplicate key, or ambiguous legacy label fails validation or the Website build with a useful message.
- The creation-instructions and Portal instruction experience still works.
- Paperform and booking submission behavior is unchanged.

## Phase 2: server catalogue and Portal compatibility

Move the booking system before changing Paperform. This lets the server understand both old and new submissions during the form cutover.

- [ ] Add server catalogue reads for active and retired offerings.
- [ ] Resolve an offering by package plus stable key, current label, or legacy label.
- [ ] Change new booking creation fields from a compile-time union to validated stable catalogue keys.
- [ ] Keep the old `CREATIONS` map as a temporary fallback for historical Firestore data.
- [ ] Update booking display helpers and emails to resolve catalogue names, with a safe fallback for old keys.
- [ ] Expose active package offerings to the Portal through tRPC.
- [ ] Move the Existing Booking form's creation menus from hardcoded constants to the server catalogue.
- [ ] Preserve retired selections when editing an old booking, but do not offer them for a new selection.
- [ ] Add structured logging for unknown Paperform values rather than silently dropping them.

Phase 2 is complete when the server and Portal can handle the current Paperform labels, future stable keys, renamed labels, and retired creations.

## Phase 3: Paperform

Keep one Multiple Choice question per package and preserve option images, columns, selection limits, and conditional logic.

The preferred implementation is a Sanity publish sync handled by the server Paperform adapter:

1. Receive the existing Sanity publish signal or run from the same publication workflow.
2. Query and validate the complete published catalogue without the Sanity CDN.
3. Build the studio and mobile option lists for each package.
4. Compare them with the existing Paperform fields.
5. Update only changed fields through Paperform's field update endpoint.
6. Verify the resulting labels, order, limits, and option images.
7. Report a failed or partial sync with enough detail to retry safely.

The sync must be idempotent. It must keep Paperform field IDs in server configuration and map them by stable package key.

The exact image update method remains conditional on the Phase 0 Paperform test:

- If the supported field update preserves and can update image associations safely, automate labels, order, and images.
- If it preserves images only when labels and order stay fixed, add a guarded workflow that blocks unsafe changes and explains the required manual Paperform step.
- If the API cannot support image-backed choices reliably, do not replace the current form with dropdowns. Keep the customer experience and implement a drift report plus a documented manual image-sync step while checking with Paperform for a supported image API.

Submission handling should use package context when resolving labels. This avoids collisions between packages and lets renamed options resolve through `legacyLabels`. Once Paperform can submit a stable value independently of its visible label, prefer that stable value.

### Phase 3 acceptance criteria

- Every active Website creation appears in the matching Paperform package question for each applicable channel.
- Paperform displays the same image as the Website package entry.
- Package order, option order, selection limits, and conditional visibility remain correct.
- A Paperform submission stores stable offering keys on the booking.
- Renaming or retiring an offering does not break old submissions or bookings.
- A failed sync is visible and retryable. It does not silently leave the team believing Paperform matches Sanity.

## Phase 4: cleanup

- [ ] Remove the active `CREATION_PACKAGES`, `CREATION_PACKAGE_DISPLAY_NAMES`, and `ACTIVE_CREATIONS` catalogue after all consumers have moved.
- [ ] Retain the minimum legacy key mapping needed for historical records, or migrate those records before deleting it.
- [ ] Remove old Paperform label-to-key code after the oldest resubmittable form data no longer needs it.
- [ ] Deprecate the old recipe-reference field on `birthdayPartyPackage` only after Portal instruction queries use the new offering-to-recipe relationship.
- [ ] Update the Website, Studio, server, Portal, and core READMEs to describe the final ownership model.

## Verification

Automated coverage should include:

- Catalogue normalization and validation tests in core.
- Website query fixtures for reused offerings, package-specific presentation, and retired content.
- Website build coverage for missing assets and broken references.
- Server lookup tests for stable keys, current labels, legacy labels, package context, and unknown values.
- Portal tests for active options and retained retired selections.
- Paperform diff and update tests with the provider client mocked.
- A read-only drift check comparing Sanity with Paperform after Phase 3.

Manual verification should include:

- Side-by-side screenshots of every package on the old and new Website builds.
- Desktop and mobile Paperform checks for every package question.
- A test submission containing creations from more than one package.
- Reprocessing an old submission after one option has been renamed.
- Editing a booking whose creation has been retired.

Run the relevant repository checks at the end of each phase. Phase 1 must include `npm run build --workspace website` and `npm run build --workspace sanity-studio`. Server and Portal phases must include their scoped tests and the root checks.

## Relevant code

- Website catalogue page: `apps/website/src/pages/birthday-parties/creations.astro`
- Website package modules: `apps/website/src/components/creation-packages`
- Website creation cards: `apps/website/src/components/creations`
- Website Sanity adapter: `apps/website/src/utils/sanity-api-client.ts`
- Sanity package schema: `apps/sanity-studio/schemaTypes/documents/birthday-party-package.ts`
- Sanity recipe schema: `apps/sanity-studio/schemaTypes/documents/birthday-party-creation.ts`
- Shared hardcoded catalogue: `packages/core/src/parties/creations.ts`
- Server Sanity adapter: `apps/server/src/integrations/sanity/sanity.client.ts`
- Paperform client and field mapping: `apps/server/src/integrations/paperforms/paperform.client.ts`
- Submission mapping: `apps/server/src/features/party-bookings/core/party-form-mapper.ts`
- Portal booking editor: `apps/portal/src/features/bookings/parties/forms/ExistingBookingForm/index.tsx`

## External references

- [Paperform field update endpoint](https://paperform.readme.io/reference/updateformfield)
- [Paperform Multiple Choice option images](https://paperform.co/help/articles/can-multiple-choice-options-have-images/)
- [Sanity schema design guidance](https://www.sanity.io/docs/schema-types)
