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

`website.md` contains only what's on the public website, so it can be rebuilt from scratch at any time without losing anything. Custom information belongs in `additional-info.md`.

To bring it back in line after the website changes, ask an agent to "update Frankie's knowledge". The steps and rules live in [`.agents/skills/update-frankie-knowledge`](../../../../../.agents/skills/update-frankie-knowledge/SKILL.md).

## Transcripts and analytics

Every reply saves the whole conversation to Firestore at `websiteChats/{chatId}`: a readable transcript, the model, the entry page, timings, the customer's message count and whether an enquiry was sent. The widget sends the full history each time, so the latest save is always complete.

Conversations never end explicitly. `finishWebsiteChats` runs on the `background` Pub/Sub dispatcher every 15 minutes and finishes chats idle for `WEBSITE_CHAT_IDLE_MINUTES` (30). Each finished chat sends one Mixpanel `Website Chat Finished` event with the `chatId` to look up its transcript, `messageCount`, `durationMinutes`, `outcome` (`enquiry` or `none`), `model` and `entryPage`. The widget starts a fresh conversation after the same idle time when a page loads. A chat that carries on after finishing (e.g. a tab left open overnight) reopens and is reported again with its latest outcome and `resumed: true`, so count conversations by unique `chatId` and take each chat's latest `outcome`.

Enquiries left by Frankie also add the chat transcript to the Zoho deal description.

Super-admins can read every transcript in the Portal under **Chat Transcripts** (`/dashboard/website-chats`). They can also delete transcripts from the table. The `websiteChats` tRPC router checks the `website-chats:read` and `website-chats:delete` permissions, which only super-admins have, because transcripts include customers' contact details.

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
