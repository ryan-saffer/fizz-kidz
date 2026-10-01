---
name: update-frankie-knowledge
description: Bring Frankie's website knowledge (the website chat's website.md) back in line with the public website. Use when asked to update, refresh or sync Frankie's knowledge, or after changing customer-facing website content.
---

# Update Frankie's knowledge

Frankie, the website chat assistant, answers from `apps/server/src/features/website-chat/core/prompt/website.md`: a hand-maintained copy of what customers can see on www.fizzkidz.com.au. The website changes; this file doesn't follow on its own. Your job is to close that **drift**: find everything customer-facing that changed since the file was last updated, and bring the file back in line.

## Steps

1. **Find the last update.** Run `git log -1 --format='%H %cs %s' -- apps/server/src/features/website-chat/core/prompt/website.md`. That commit is the **baseline**. Also check `git status` for uncommitted edits to the file: if there are any, confirm with the user whether they're part of this update before building on them. Done when you have a baseline commit and date.

2. **List what changed since the baseline.** Two sources, because website content lives in two places:
   - **Git**: run `git log --oneline <baseline>..HEAD` and `git diff <baseline> -- <paths>` over the customer-facing paths below, plus `git diff HEAD -- <paths>` for uncommitted work. Read each diff for what a customer would see: prices, dates, days, studios, services, inclusions, FAQs, links and page URLs.
   - **Sanity**: party packages and the holiday program schedule are published in Sanity, so their changes never appear in git. Read the live pages instead (`https://www.fizzkidz.com.au/birthday-parties/`, each package page it links to, and `https://www.fizzkidz.com.au/holiday-programs/`) and compare them with `website.md`.
   - **Time**: today's date can make content stale with no change at all. Note every date in `website.md` that has passed: finished holiday program weeks, past terms, past events.

   Done when every change from all three sources is on a list, each marked **update** (a customer would see a difference) or **skip** (styling, refactors, internal code), with a reason.

3. **Update `website.md`.** Apply every item marked update, following the rules below. Keep the file's existing structure and headings, and change only what the drift requires. Set the `Last updated` line at the top to today's date. Done when every update item is reflected in the file.

4. **Check the other prompt files for knock-on effects.** Read `behaviour.md` and `additional-info.md` in the same folder for examples or facts the update contradicts or makes redundant (for example, an example of something Frankie "doesn't know" that the website now states). Fix examples in `behaviour.md` directly. `additional-info.md` belongs to the Fizz Kidz team, so report conflicts with it to the user rather than editing it. Done when both files are read and every conflict is fixed or reported.

5. **Report.** Give the user the baseline, the list from step 2 with what you did for each item, anything you reported from step 4, and any gaps (for example, a price the website no longer shows).

## Customer-facing paths

- `apps/website/src/pages`
- `apps/website/src/components`
- `apps/website/src/data`
- `apps/website/src/utils/studios.ts`
- `apps/website/public/llms.txt`
- `packages/core/src/website/website-forms.ts` (enquiry form options, such as party themes and studios)

## Rules for `website.md`

- It holds only what the public website shows, so it can be rebuilt from scratch without losing anything. Custom information from the team belongs in `additional-info.md`.
- Source from customer-facing content only: the paths above and the live site. The staff knowledge base in `apps/docs` is internal.
- Quote prices, dates and times exactly as the website shows them. Leave calculations to the website.
- Link with absolute `https://www.fizzkidz.com.au/...` URLs that exist on the live site (booking links are on `https://bookings.fizzkidz.com.au`).
- Remove anything that has finished.
- Prompt files are bundled into the server, so the change reaches Frankie on the next server deploy.
