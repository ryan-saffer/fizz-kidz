# `@fizz-kidz/ui`

Shared React UI used by more than one Fizz Kidz app. Components here must remain independent of app-specific routing, state, credentials, and SDK clients.

## Creation Instructions

`CreationInstructions` renders the structured instruction content returned by the server. The Portal uses it for staff-facing instructions, and Sanity Studio uses it for the live editor preview. Keeping the renderer and its Fizz-branded typography, marks, lists, callouts, dividers, and image treatment here makes the Studio preview match the Portal without coupling either app to the other's styling system.

Image URLs must be resolved before content reaches the component. The server resolves Sanity assets in GROQ, while the Studio adapter resolves unsaved image references with its authenticated Sanity client.

## Holiday Program Schedule

`HolidayProgramSchedule` is rendered statically by Astro and rendered directly by the Sanity Studio preview. Its JSX uses Tailwind utilities. Every consumer must scan `packages/ui/src` and use the exported `@fizz-kidz/ui/tailwind-preset`; Studio consumers should disable Tailwind preflight. Import `@fizz-kidz/ui/brand-fonts.css` once in each app to load the same bundled Gotham and Lilita One files.

```bash
npm run build --workspace @fizz-kidz/ui
```
