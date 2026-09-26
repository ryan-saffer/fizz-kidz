# Party details form

`/party-form-v2?id=<bookingId>` is the custom customer party-details journey, replacing the hosted Paperform. It uses Zustand, TanStack Form and Tailwind; the `party` colours, `party-glow` background and `party-enter` animation are in the portal Tailwind config. The server side is in `apps/server/src/features/party-bookings/core/party-form-v2`.

## How it works

Start with `state/party-form-store.ts`. The store holds the whole journey: the steps for this booking, navigation and validation, the review step's checkout (discount code, gift card) and paying, including checking an unclear payment again. Components read from it and call its actions rather than passing state down.

- `state/form.ts` is the TanStack form: the answers, their defaults and validators, and `toPayload`, which turns them into what the server receives. The store reads and validates it; step components render its fields.
- `state/steps.ts` lists the steps for a booking and mode.
- `components/party-form.tsx` creates the form, registers it and the two tRPC mutations with the store, and renders the current stage.
- `components/steps/` has one component per step, plus the creation and addition pickers and the review summary. `components/layout/` has the page shell, welcome, progress bar, step heading, Back/Next bar and confirmation. `components/payment/` has the Square checkout and the payment status panel. `components/common/` has the shared cards, fields and `LoadingState`.
- `utils/display.ts` has display prices and names; `utils/copy.ts` has the Paperform copy for creation questions.

`?mode=cake` opens the cake form, which only has the cake and goodies steps and review (see the server README). The mode only changes the step list and some wording; only listed steps are mounted, so party questions never validate in cake mode. A cake already on the booking shows read-only, and each goodie shows how many were already ordered. Where cakes can't be ordered (`cakeOptions` is null), the cake step is left out.

## Steps and validation

Moving forward (Next, or jumping ahead on the progress bar) validates every earlier step and shows the first incomplete one. Inactive steps stay mounted but hidden so TanStack keeps their values and validators. Answers live in memory until submission; a refresh starts again.

The creation picker shows every theme by default and can filter to one; a creation offered in several themes can only be picked once. Creations and their studio/mobile availability come from Sanity. The cake step (sizes, designs with photos, flavours and their limits, serving, candles, prices), food additions and take-home goodies come from Square through the form config. Goodies are sold in lots of at least 12, so the first + jumps to 12; once ordered, they can be topped up one at a time.

Headings, paragraphs and question labels follow the production Paperform `4c6karmx` (version 79), including its studio/mobile differences. Keep that wording rather than rewriting customer copy.

## Payment

Entering the review step prepares a checkout: the store sends the answers (and any discount code or gift card) and the server returns the Square-priced summary. Food is paid at the end of the party, so it isn't included. `components/payment/party-payment.tsx` embeds Square Web Payments (Apple Pay, Google Pay and card; wallets skip buyer verification). Card details stay in Square's inputs.

Paying sends the same answers with the checkout id and Square token. The request is kept in this tab's session storage until the server confirms it or it definitely fails, so a reload shows the payment status panel and checks the same payment instead of starting another. It holds only Square's single-use token. An unclear result locks editing and offers **Check payment status**; after a few unconfirmed checks the customer is asked to email us rather than pay again. A definite failure (e.g. a declined card) unlocks editing and needs **Refresh payment summary** for a new checkout.

## Tests

Tests live in a `__tests__` folder next to the file they cover (e.g. `components/__tests__/party-form.test.tsx` tests `components/party-form.tsx`). This is being tried here, in the server party form and in payments before the rest of the repo.

```bash
vp test --run --project portal apps/portal/src/features/party-form-v2
```
