# BuildQuote — Custom Truck Quoting Dashboard

An AI-assisted dashboard where employees enter what a customer wants for a
custom-built truck (food truck, coffee truck, etc.), generate an itemized quote,
refine it conversationally, and export a clean PDF.

It is built as a **framework first**: the AI that produces quotes is a pluggable
provider. The dashboard works end-to-end before any AI is connected (using a
built-in sample estimator), and connecting a real AI is a drop-in.

## What's here

- **Dashboard** (`/`) — list of quotes, pipeline value, AI connection status.
- **New Quote** (`/quotes/new`) — enter customer requirements → generate a quote.
- **Quote detail** (`/quotes/[id]`) — view the itemized quote, **refine it**
  ("anything to modify?"), set status, and **export a PDF**.
- **Knowledge & Training** (`/knowledge`) — upload prior quotes, emails, pricing
  sheets, and docs (the AI's reference "knowledge base"), and edit the AI's
  **behavior instructions** and provider/model. This is how you "train" the
  connected AI — its instructions + your documents steer every quote. No
  fine-tuning required.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres) for quotes, training documents, and AI settings
- Pluggable AI provider layer (`lib/ai/`) — `sample` (built-in) and `anthropic`
  (Claude) included; add others by implementing one interface.

## Environment variables

| Variable             | Required | Notes |
| -------------------- | -------- | ----- |
| `SUPABASE_URL`       | no\*     | Defaults baked in for the test project. |
| `SUPABASE_ANON_KEY`  | no\*     | Publishable key; safe to expose. |
| `ANTHROPIC_API_KEY`  | only for Claude | Needed when provider = `anthropic`. |

\* Working defaults are compiled in so it deploys without config. Override to
point at a different Supabase project.

## Connecting an AI (e.g. Claude)

1. Set `ANTHROPIC_API_KEY` in the environment (Vercel → Settings → Env Vars).
2. On **Knowledge & Training**, set provider to `anthropic` and model to
   `claude-opus-4-8`, then save.
3. Upload some prior quotes/emails and adjust the behavior instructions.

To add a different provider, implement the `QuoteAiProvider` interface in
`lib/ai/` and register it in `lib/ai/index.ts`.

## Deploy

Connect this repository to Vercel (Framework preset: Next.js). Add the env vars
above. Each push to the deployment branch auto-builds.

## Local dev

```bash
npm install
npm run dev
```
