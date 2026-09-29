# Website chat

The chat assistant on the public website. The website widget posts to `POST /api/chat`, which streams the reply from a model routed through the Vercel AI Gateway (`AI_GATEWAY_API_KEY`).

The assistant (Frankie) is configured with plain markdown in [`core/prompt`](core/prompt), bundled into the server as text:

| File                 | What it controls                                                               | Who edits it                 |
| -------------------- | ------------------------------------------------------------------------------ | ---------------------------- |
| `persona.md`         | Who Frankie is and how Frankie sounds                                          | Owner                        |
| `behaviour.md`       | What Frankie does, how much to say, and the rules to follow                    | Owner                        |
| `website.md`         | What customers can see on the website, so Frankie can answer and link to pages | Regenerated from the website |
| `additional-info.md` | Answers the website doesn't cover, or that we keep off it on purpose           | Staff                        |

They're joined in that order into one system prompt (`core/website-chat-instructions.ts`), followed by today's date and the visitor's current page. HTML comments in `additional-info.md` are editor notes and are stripped from the prompt. Edit the files and redeploy the server to change the bot.

## Keeping `website.md` current

`website.md` contains only what's on the public website, so it can be rebuilt from scratch at any time without losing anything. Never add custom information to it; that belongs in `additional-info.md`.

When the website changes meaningfully (a new party package, new holiday program dates, price changes), review the customer-facing website against it and update or rebuild it:

- Use only customer-facing content: `apps/website/src/pages`, `apps/website/src/components`, and the Sanity-driven pages as they render on the live site. Never the internal staff knowledge base (`apps/docs`).
- Quote prices and dates exactly as the website shows them. Don't infer or calculate.
- Use absolute `https://www.fizzkidz.com.au/...` links that exist on the live site.
- Remove anything that has finished, such as past holiday program weeks.
- Update the `Last updated` line at the top.

## Transcripts and analytics

Every reply saves the whole conversation to Firestore at `websiteChats/{chatId}`: a readable transcript, the model, the entry page, timings, the customer's message count and whether an enquiry was sent. The widget sends the full history each time, so the latest save is always complete.

Conversations never end explicitly. `finishWebsiteChats` runs on the `background` Pub/Sub dispatcher every 15 minutes and finishes chats idle for `WEBSITE_CHAT_IDLE_MINUTES` (30). Each finished chat sends one Mixpanel `Website Chat Finished` event with the `chatId` to look up its transcript, `messageCount`, `durationMinutes`, `outcome` (`enquiry` or `none`), `model` and `entryPage`. The widget starts a fresh conversation after the same idle time.

Enquiries left by Frankie also add the chat transcript to the Zoho deal description.

The schedule lives in Cloud Scheduler, not in code. Create it once per project:

```bash
gcloud scheduler jobs create pubsub finish-website-chats \
  --project=<booking-system-6435d|bookings-prod> \
  --location=australia-southeast1 \
  --schedule="*/15 * * * *" \
  --time-zone="Australia/Melbourne" \
  --topic=background \
  --message-body='{"name":"finishWebsiteChats"}'
```
