# Sanity Studio

The content studio for Fizz Kidz. It is a standalone Sanity app in the npm workspace and connects to project `rjsv3y4b`, dataset `production`.

The Studio manages public Website images, the Birthday Party package catalogue, and the Holiday Program schedule plus Birthday Party and Holiday Program creation instructions. `holidayProgramWeek` documents contain the schedule cards and show a live Website preview. Birthday Party packages keep their existing ordered creation-instruction references while using one ordered Website-card list for customer-facing creations. Each creation can point to one reusable `birthdayPartyCreation` instruction document. Published changes are read by the Website or server and shown in their respective interfaces.

Holiday Program instructions have `live` and `archived` statuses. Only published live instructions appear in Portal. Use **Holiday Programs > Search instructions** to search across both statuses without changing the global search type filter. The archive remains searchable so editors can reuse previous recipes when preparing a new schedule; move the previous live set to archived after each program period.

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

- **Party packages > Packages** owns Website order, headings, package presentation, and one ordered Website-card list. Every card references a creation; exactly one card per creation also owns its booking channels and booking-menu order.
- **Party packages > Creations** owns stable booking keys, customer names, default images, previous Paperform labels, status, and the optional creation-instructions relationship.
- **Creation instructions** remains the reusable instruction library consumed by the Portal.

The Phase 1 migration source is `migrations/birthday-party-catalogue-source.ts`. From `apps/sanity-studio`, validate it against the current production assets and creation instructions with a read-only dry run:

```bash
npx sanity exec migrations/import-birthday-party-catalogue.ts --with-user-token
```

Pass `-- --apply` only after reviewing `docs/birthday-party-creation-catalogue-inventory.md`. Apply creates or replaces migration-owned drafts and never publishes them. It refuses to overwrite unrelated package or creation drafts.

For an existing import created before creation images were added, pass `-- --apply-images` to fill only missing image fields from **Website images > Creations**. This leaves every other reviewed draft field—and any image already selected by an editor—unchanged.

The one-time `migrate-birthday-party-package-cards.ts` migration collapses the old duplicate package-creation list into the Website cards. It is dry-run by default; pass `-- --apply` to patch only card fields and remove the obsolete list. It never publishes documents.

Validate the stored draft graph, including booking order and the non-contiguous Jungle Safari card sequence, with:

```bash
npx sanity exec migrations/verify-birthday-party-catalogue-drafts.ts --with-user-token
```

The shared `@fizz-kidz/ui` `CreationInstructions` component renders both the Studio preview and the Portal output. On wide screens the Portable Text editor and sticky Portal preview appear side by side, with editor scrolling mirrored proportionally in the preview; narrower screens use a stacked layout. The editor opens active at a tall viewport-based height and remains manually resizable. The Studio owns only the adapter that resolves unpublished Sanity image references.

The shared `HolidayProgramSchedule` React component renders statically in Astro and directly in the Studio preview. Both consumers scan `packages/ui/src` with Tailwind and use the shared UI preset and bundled brand fonts. Studio disables Tailwind preflight so the preview utilities do not reset Sanity's interface.

External image blocks remain supported for content hosted outside Sanity. New images can be uploaded directly to Sanity.

## Website Images

`websiteImage` documents are stable Website slots grouped into category folders under **Website images**. Replacing the image in a slot does not change Website code. The Website resolves every required slot from Sanity once during its build and fails clearly if a slot is missing.

Use **Website images > Bulk replace images** to replace a folder in one operation. Select the folder and all replacement files; the tool matches files against the slots' original filenames and reports matched, missing, unmatched, and ambiguous names. Replacements are staged as drafts, can be reviewed across multiple folders, and only update production when **Publish staged images** is pressed. Existing manual drafts are never included automatically. Creation filenames are unique, so all 59 Creation images can be selected, reviewed, and published together. Published image changes appear after the next Website build.

## Deployment

`npm run deploy --workspace sanity-studio` deploys the hosted Studio to `fizz-kidz.sanity.studio`.

The deployment workflow automatically deploys the Studio from `main` when the Studio, `packages/ui`, `packages/core`, or shared dependency files change. Changes on `develop` are checked but do not overwrite the production Studio. GitHub's `prod` Environment must provide the `SANITY_AUTH_TOKEN` deploy-token secret.
