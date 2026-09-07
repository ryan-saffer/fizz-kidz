# Party details form

`/party-form-v2?id=<bookingId>` is the custom customer party-details journey. It uses TanStack Form and a dedicated layout in `party-form-v2.css`.

The welcome screen leads into party details, creations, studio food, cake where available, take-home goodies, personal notes, and review. Forward navigation is available when every preceding step has valid required answers, including conditional cake questions. Clearing a required answer blocks later steps again. Inactive steps stay mounted but hidden so TanStack retains their validators and values. The final submit validates the whole form before calling tRPC. Answers live in memory until submission; refreshing starts the form again.

`party-form-v2-creations.tsx` owns theme browsing and photo choices. All themes are shown by default; parents can filter to a single theme. Selections survive filter changes, and a creation offered in multiple themes can only be selected once. The server combines the operational booking catalogue with Sanity package-card images, using each card's image override or the creation's default image. Photos are resized on Sanity's CDN with crop and hotspot settings preserved. Availability still comes from the booking catalogue.

`party-form-v2-experience.tsx` contains the welcome, progress, step headings and review. Display prices in `party-form-v2-pricing.ts` cover new cake and gift purchases only. Food stays on the party invoice, and existing purchases are shown separately. The server's Square catalogue determines the actual checkout amount.

Headings, paragraphs, question labels and helper text use the production Paperform `4c6karmx`, version 79, including its non-question content blocks and studio/mobile differences. Preserve that wording rather than adding or rewriting customer copy. Package question copy and bag labels live in `party-form-v2-copy.ts`. Review, navigation and filtering use short functional labels. Food additions, cake choices and take-home gifts use the shared option lists in `@fizz-kidz/core`; creation names and availability come from Sanity.

Run the journey tests with:

```bash
vp test --run --project portal apps/portal/src/features/party-form-v2/party-form-v2-form.test.tsx
```
