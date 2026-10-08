# Commercial MVP implementation notes

This branch adds the nonproduction commercialization spine described by
`docs/MVP_DECISIONS.md`:

- Supabase Auth verifies every model-backed request server-side.
- Supabase Postgres owns profiles, history, atomic interview authorization,
  usage events, cost events, and Stripe webhook idempotency.
- Stripe checkout and webhook handlers are test-mode/configuration driven.
- Local history remains a recoverable cache and merges into authenticated
  server history.
- The GPT-Live/OpenAI WebRTC path from `main` remains intact.

## Required environment

Browser:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Server:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
OPENAI_API_KEY
FREE_MONTHLY_INTERVIEWS
PRO_MONTHLY_INTERVIEWS
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
APP_URL
```

Prices, limits, hosted-project credentials, and Stripe price IDs are not
selected by this code change. They must be supplied explicitly for a
nonproduction deployment.

## Database setup

Apply `supabase/migrations/202610070001_commercial_mvp.sql` to the approved
nonproduction Supabase project. Do not apply it to production without the
approval gate in `docs/MVP_DECISIONS.md`.

## Verification

```text
npm test
npx tsc --noEmit
npm run build
npm run check:bundle
```

The Stripe CLI and Supabase CLI/MCP are only needed for the later
nonproduction stranger-path smoke test; no external resources were created or
modified during repository implementation.
