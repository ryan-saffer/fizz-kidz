# Sanity Studio

The content studio for Fizz Kidz. It is a standalone Sanity app in the npm workspace and connects to project `rjsv3y4b`, dataset `production`.

The Studio manages public Website images, the Birthday Party package catalogue and package pages, and the Holiday Program schedule plus Birthday Party and Holiday Program creation instructions. `holidayProgramWeek` documents contain the schedule cards and show a live Website preview. Customer Birthday Party packages derive their ordered instructions through creation references in one ordered Website-card list; staff-only packages such as Sweet Kitty own a direct instruction list. Each creation can point to one reusable `birthdayPartyCreation` instruction document. Published changes are read by the Website or server and shown in their respective interfaces.

Holiday Program instructions have `live` and `archived` statuses. Only published live instructions appear in Portal. Use **Holiday Programs > Search instructions** to search across both statuses without changing the global search type filter. The archive remains searchable so editors can reuse previous instructions when preparing a new schedule; move the previous live set to archived after each program period.

## Commands

Run commands from the repository root:

```bash
npm run sanity
npm run check:sanity
npm run build --workspace sanity-studio
```

The production dataset is used in local development. Treat edits in the Studio as live content changes.

## Structure

- `sanity.config.ts` configures the Studio, plugins, project, and dataset.
- `sanity.cli.ts` configures Sanity CLI commands and hosted Studio auto-updates.
- `schemaTypes/` owns content schemas. Export every schema from `schemaTypes/index.ts`.
- `components/` contains the shared creation-instruction input and Portal-style preview.
- `structure.ts` groups Website image slots into folders matching the Website structure.
- `static/` contains files copied into the Studio build.

Keep the Studio standalone rather than embedding it in another app. Use kebab-case schema filenames and Sanity's `defineType` and `defineField` helpers when adding schemas.

## Birthday Party catalogue

The Birthday Party area separates customer content from staff instructions:

- **Packages** owns the canonical package name, primary and accent colours, one position, one ordered Website-card list, and the generated Website page. Position controls Portal instruction groups and, for active packages, the Website menu, Party Themes cards, and all-creations catalogue. The form separates core package information from Website route, SEO, page content, and listing settings. Every creation card references a creation; exactly one card per creation owns its booking-menu order.
- **Creations > Live** owns current booking choices, including stable keys, customer names, operational studio/mobile availability, default images, previous Paperform labels, and optional creation instructions. Availability belongs to the creation and applies everywhere it is used. **Creations > Archived** contains historical choices retained for old bookings; archived creations are not offered for new bookings and do not require availability or Website images. Each creation displays a derived, read-only list of every package whose Website cards reference it.
- **Creation instructions** remains the reusable instruction library consumed by the Portal. Each instruction displays a derived, read-only list of every creation that references it; one instruction can be shared by multiple creations.

Package Party Themes and creations-section images must use clean artwork without a baked-in **New** graphic. **Website page > Website menu > Show the New badge** controls the menu badge and both Website image overlays.

The catalogue migration and post-deployment field cleanup are complete. Production Sanity contains 50 live creations, 66 archived historical creations, and no migration markers, duplicate package fields, card-level availability, or old instruction references. The completed one-time migration scripts were removed; Git history retains the audit trail.

Package labels are derived from **Package name**: the Portal, Website menu, and Party Themes use `{Package name} Parties`; the all-creations page uses `{Package name} Creations`; and the creations-section image description uses `{Package name} Party Package`. **Primary colour** and **Accent colour** are selected from the same shared named-colour list. Primary supplies the Website introduction and Portal instruction colour; accent supplies the all-creations heading and Party Themes card. The separate black-background toggle is the Fluid Bears presentation exception.

Customer catalogue packages derive their Portal instructions through their creation references. Sweet Kitty remains a staff-only package and therefore owns a direct **Staff-only creation instructions** list.

An active package can publish only with complete Website-page content. Its slug creates `/birthday-parties/{slug}/`, cannot change after first publication, and cannot use the reserved At Home, booking, or creations paths. Website position must be unique across active packages. Publishing triggers the existing Website rebuild; after that build succeeds, a new package appears in navigation, Party Themes, creations, and the sitemap without a code change. Retiring it removes those generated surfaces on the next successful build. Optional feature sections support package-specific content such as Slime Lab. At Home is still owned by Website code.

The shared `@fizz-kidz/ui` `CreationInstructions` component renders both the Studio preview and the Portal output. On wide screens the Portable Text editor and sticky Portal preview appear side by side, with editor scrolling mirrored proportionally in the preview; narrower screens use a stacked layout. The editor opens active at a tall viewport-based height and remains manually resizable. The Studio owns only the adapter that resolves unpublished Sanity image references.

The shared `HolidayProgramSchedule` React component renders statically in Astro and directly in the Studio preview. Both consumers scan `packages/ui/src` with Tailwind and use the shared UI preset and bundled brand fonts. Studio disables Tailwind preflight so the preview utilities do not reset Sanity's interface.

External image blocks remain supported for content hosted outside Sanity. New images can be uploaded directly to Sanity.

## Website Images

`websiteImage` documents are stable Website slots grouped into category folders under **Website images**. Replacing the image in a slot does not change Website code. The Website resolves every required slot from Sanity once during its build and fails clearly if a slot is missing.

Use **Website images > Bulk replace images** to replace a folder in one operation. Select the folder and all replacement files; the tool matches files against the slots' original filenames and reports matched, missing, unmatched, and ambiguous names. Replacements are staged as drafts, can be reviewed across multiple folders, and only update production when **Publish staged images** is pressed. Existing manual drafts are never included automatically. Birthday-party catalogue imagery now belongs to creation, package-card, and package-page documents; only the three homepage Slime Lab cards still consume **Website images > Creations** slots. Published image changes appear after the next Website build.

## Deployment

`npm run deploy --workspace sanity-studio` deploys the hosted Studio to `fizz-kidz.sanity.studio`.

The deployment workflow automatically deploys the Studio from `main` when the Studio, `packages/ui`, `packages/core`, or shared dependency files change. Changes on `develop` are checked but do not overwrite the production Studio. GitHub's `prod` Environment must provide the `SANITY_AUTH_TOKEN` deploy-token secret.
