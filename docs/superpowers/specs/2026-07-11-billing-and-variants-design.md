# Billing, Backend Gateway & Variant Deployments — Design Spec

**Date:** 2026-07-11
**Status:** Draft — pending review
**Depends on:** the two-theme redesign (`theme-redesign` branch); ships as its own phase after themes merge.

## 1. Overview

Three intertwined capabilities, specified together because they share one backend spine:

1. **Backend gateway** — move all Gemini access server-side (Vercel functions), eliminating the API key in the client bundle. This is the prerequisite for everything else and unblocks removing the `noindex` pre-launch lock.
2. **Auth, sync & billing** — Supabase auth + Postgres for identity and cross-device history sync (fulfilling the pricing band's existing "sign in to keep your log" promise), with Stripe checkout/webhooks flipping a plan flag that the gateway enforces.
3. **Variant deployments** — one repo, two public Vercel deployments ("PB" and "Tscript" working titles), parameterized by env var, for the naming/positioning experiment. Single codebase; zero forking.

### Commercial model

- **Free tier:** N interviews per calendar month (N = 3 initially; a config constant, not hardcoded inline). Requires sign-in — there is no anonymous interview path (see §5, correction C2).
- **Paid tier:** one flat monthly subscription with a fair-use cap (M interviews/month, M = 30 initially). No credits, no metering UI. Voice and text interviews cost the same quota unit (1) for now.
- **Quota unit:** one "interview" is consumed when an interview *starts* (first chat turn for text; initial Live-token mint for voice) — not per question, and not on the setup screens.

### Stack decision (settled in prior discussion)

Vercel serverless functions (app already deploys there; paid account) + Supabase (auth + Postgres; free tier) + **Stripe direct** (not a merchant-of-record). Stripe was chosen over Polar/Paddle because `newroom` already establishes Stripe as the portfolio's billing vendor with working checkout/webhook patterns, making the MoR tax-relief argument moot (the Stripe MoR obligation exists regardless) and vendor consolidation the dominant concern. Tax handling: defer registration questions until revenue is non-trivial; enable Stripe Tax *calculation* from day one so the data exists.

## 2. Reference implementation caveat — `newroom`

`~/newroom-1` (Netlify/Supabase/Stripe) is the pattern donor for the billing spine, **but a security audit (Fable 5, 2026-07) found serious vulnerabilities and remediation is still in progress**. Reliance is therefore *selective*: patterns are individually adopted or corrected below. Nothing is ported verbatim.

### Patterns adopted from newroom (verified sound)

| Pattern | Where it lives in newroom | Why it's kept |
|---|---|---|
| Model fallback chain (try primary, fall back, record last error) | `generate-room.ts` | Cheap resilience against model retirements/outages |
| Atomic quota mutation with optimistic concurrency | `generate-room.ts` credit deduction | Prevents double-spend races (we simplify to a single conditional `UPDATE … RETURNING`, same property) |
| Refund-on-failure in `finally` | `generate-room.ts` | User never pays quota for a failed generation |
| Best-effort persistence isolated from the critical path | `saveDesignBestEffort` | Gallery/history writes must never break the paid action |
| `error_logs` table with severity/source/metadata | `_shared/errors.ts` | Serverless observability without a vendor |
| Webhook: signature verification + tier logic server-side | `stripe-webhook.ts` | Standard, correct |

### Corrections — where the newroom approach was broken or incomplete

These are the deficiencies identified (confirmed by direct code reading, 2026-07-11); HirePrep's gateway does the opposite:

- **C1 — Client-asserted identity.** newroom's functions take `userId` from the request body (an email string or anon id) and act on it — no verification. Consequence: anyone can spend another user's paid credits by posting their email. **Correction:** identity comes exclusively from a verified Supabase JWT (`Authorization: Bearer` header, validated server-side with `supabase.auth.getUser(jwt)`). No endpoint ever reads identity from the body. There is no email-vs-anon-id branching because there is no client-supplied id at all.
- **C2 — Anonymous unlimited access to the paid resource.** newroom's generate endpoint works with no `userId` (unlimited, un-tracked) — an open proxy to a metered API. **Correction:** every Gemini-touching endpoint returns 401 without a valid JWT. The free tier exists, but it is authenticated and quota-bounded. (Deliberate product tradeoff: a try-before-signup demo is out of scope; the Home mockups' sample content serves that role.)
- **C3 — `Access-Control-Allow-Origin: *`.** **Correction:** CORS allowlist of exactly the deployed origins (both variant domains, the preview/testing domain, `localhost:3000`), driven by env config.
- **C4 — Advisory quota, enforced elsewhere (or not).** newroom checks quota in a separate GET the frontend calls, while enforcement in the spend path applies only to premium users. **Correction:** the function that spends money is the function that enforces quota, atomically, in the same request. A read-only `GET /api/me` exists for UI display but is never load-bearing.
- **C5 — Raw error leakage.** newroom returns `error.message` from internal failures to the client. **Correction:** client gets a stable error code + generic message; details go to `error_logs`.
- **C6 — Refund race.** newroom refunds with `credits: user.credits + 1` from a stale read. **Correction:** refunds are `UPDATE … SET used = used - 1 WHERE …` relative arithmetic, never absolute values from stale state.
- **C7 — No abuse ceiling on the expensive path.** Even authenticated users shouldn't be able to hammer endpoints. **Correction:** the quota cap already bounds interview *starts*; the remaining hole is unbounded `/api/chat` turns within one session, closed with a per-`sessionId` turn ceiling (40 turns — far above any real 5–7-question interview) enforced in the same atomic check. No general rate-limiting infrastructure; documented as a deliberate hobby-scale simplification.

## 3. Backend surface (Vercel functions, `/api`)

All functions: verify JWT → resolve profile → act. Service-role Supabase client server-side; RLS still enabled as defense-in-depth (§6).

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Text-interview turn. Body: full message history + setup (role/level/JD/resume). Server assembles the system instruction (persona + `buildInterviewerSystemInstruction`) and calls `TEXT_CHEF`. **Quota: consumed on the first turn of a session** (client sends a server-issued `sessionId` from the first response on subsequent turns). |
| `/api/evaluate` | POST | Post-interview evaluation. Body: transcript + setup. Calls `EVALUATOR` with the structured-output schema (moves `SYSTEM_INSTRUCTION_FEEDBACK` + schema server-side). No quota charge (the interview already paid). |
| `/api/live-token` | POST | Voice mode. Mints a Gemini **ephemeral token** (v1alpha, preview) — single-use, ~1-min new-session window, **config-locked server-side** to `VOICE_INTERVIEWER`, the persona voice, and the assembled system instruction, so prompts stop shipping to the client entirely. Quota: consumed on initial mint. |
| `/api/live-token` (reconnect) | POST | Same endpoint with `{ reconnect: true }`: the Live API's `goAway` flow (existing `VoiceInterview` reconnect logic) needs a *fresh* token per reconnect since tokens are single-use. Server mints without charging quota if the user's most recent charged mint is within the session window (30 min). Trust tradeoff documented: a client could ride one charge for 30 min of serial sessions — acceptable at hobby scale, revisit if abused. |
| `/api/checkout` | POST | Creates a Stripe Checkout session for the paid plan. Product/price ID selected by the caller's variant (from an allowlisted `variant` claim the server validates against config — not free-form). |
| `/api/stripe-webhook` | POST | Signature-verified. Handles `checkout.session.completed`, `customer.subscription.updated/deleted` → sets `profiles.plan` + `stripe_customer_id`. **Idempotent:** processed `event.id`s recorded in `webhook_events`; duplicates no-op. |
| `/api/me` | GET | UI-display data: plan, quota used/remaining this month, synced-history availability. Never authoritative for enforcement (C4). |

### Client changes

- `InterviewChat.tsx`: swap `ai.chats.create()` for `/api/chat` calls (the SDK chat object only wraps history client-side; the proxy receives history per turn — functionally identical, still non-streaming as today).
- `VoiceInterview.tsx`: fetch `/api/live-token` before `connectLive()`; on `goAway` reconnect, fetch a fresh reconnect token. **The audio pipeline, worklet, resampler, and reconnect logic are otherwise untouched.**
- `services/geminiService.ts`: `generateFeedback` becomes a `/api/evaluate` call.
- Delete `VITE_GEMINI_API_KEY` from the client env; key lives only in Vercel function env.
- Persona selection moves server-side with the prompts (server picks persona, returns only `personaName` after the interview — the client reveal flow is unchanged; anti-repeat via `profiles.last_persona_id` instead of localStorage).

## 4. Auth & history sync (Supabase)

- Supabase Auth, email magic-link + Google OAuth (both zero-password; matches the app's low-friction posture).
- The themed "SIGN IN" buttons (currently decorative) become real.
- **History sync:** `history` table mirrors the localStorage `HistoryEntry` shape (JSONB payload + indexed columns for id/date/score/mode/variant). On first sign-in, existing localStorage entries are uploaded (one-time merge, client-initiated); thereafter writes go to both (localStorage stays as offline cache). Session Log/Home read from the server when signed in, localStorage otherwise. Signed-out use remains fully functional *except* interviews require sign-in (C2).

## 5. Data model (Postgres)

```
profiles        id (= auth.users.id), created_at, plan ('free'|'pro'),
                stripe_customer_id, last_persona_id, variant_signup ('pb'|'tscript'|null)
usage_events    id, user_id, kind ('interview_start'|'reconnect_mint'|'evaluation'),
                mode ('voice'|'text'), variant, session_id, created_at
history         id, user_id, payload jsonb, score, mode, variant, created_at
webhook_events  stripe_event_id (pk), processed_at
error_logs      id, severity, source, message, user_id, metadata, created_at
```

- Quota check = `count(usage_events where kind='interview_start' and user_id=? and created_at >= month_start)` vs. plan cap, enforced inside the charging transaction (single `INSERT … SELECT … WHERE count < cap` or an RPC; must be atomic — no read-then-insert).
- **RLS:** enabled on all tables. `profiles`/`history`: user reads own rows; `history` user-insertable (own rows). `usage_events`/`webhook_events`/`error_logs`: no client access; service-role only. All quota/plan *writes* go through functions.

## 6. Variant mechanism

- `VITE_VARIANT` env: `pb` | `tscript` | unset.
  - **Set:** locks the theme (ThemeContext ignores localStorage, forces the variant's theme), hides the switch-outfit control, sets product name/wordmark/meta/title strings from a small `variants.ts` config map, and tags all API calls (server re-validates the tag against the deployment's own env — the client string is display-only, the server's `VARIANT` env is authoritative for what gets stamped into `usage_events`/checkout).
  - **Unset (dev + friends-testing deployment):** current behavior — toggle visible, theme persisted per user.
- **Two additional Vercel projects** pointed at the same repo, each with its own domain, `VITE_VARIANT`, server `VARIANT`, and Stripe price ID env. The existing project stays as the internal/testing deployment. All three auto-deploy from `main`.
- **Stripe:** one account, two products (one per variant) so revenue attribution = product ID. Webhook is shared (product ID in the event tells us the variant).
- **GA4:** one property per variant (per prior discussion); measurement ID via the same env mechanism. Out of scope for this spec's build: event taxonomy design.
- **Shared backend:** one Supabase project for all deployments. A user account works on both variants (same email = same account); `variant_signup` records first touch, `usage_events.variant` records where activity happened. Accepted consequence: a user who finds both sites can see they share an account system — consistent with the experiment's honest-research framing.

## 7. Build order

1. **Gateway** (`/api/chat`, `/api/evaluate`, `/api/live-token` without quota — since auth doesn't exist yet, the interim guard is only the CORS allowlist plus the per-session turn ceiling; this is a known, time-boxed exposure window strictly better than today's key-in-bundle, and `noindex` stays ON until phase 2 closes it). Client swapped over.
2. **Auth + profiles + history sync.** Sign-in works; interviews now require it; gateway starts requiring JWTs (C1/C2 land here).
3. **Quota** (`usage_events`, atomic enforcement, `/api/me`, free-tier messaging in both themes' UI).
4. **Billing** (`/api/checkout`, webhook, plan enforcement, pricing-band copy update in both themes).
5. **Variants** (env mechanism, `variants.ts`, two Vercel projects, Stripe products, GA4). Independent of 3–4; can proceed in parallel after 2.

Each phase is separately shippable and separately testable. Phases 1–2 are the security-critical path and get the most careful review.

## 8. Out of scope (explicit)

- DOCX resume parsing; evaluator sub-scores; "repeat question" voice controls (all previously deferred).
- Metered/credit pricing, annual plans, team plans.
- Try-before-signup anonymous demo interview.
- Migrating `hireprep-mobile` (Expo) to the gateway — it keeps its own key posture until the shipping phase reaches it; note added to its CLAUDE.md when phase 1 lands.
- newroom remediation itself (separate project; this spec only *learns* from its audit).

## 9. Verification

- Unit: quota RPC atomicity (concurrent-request test), webhook idempotency (duplicate event replay), JWT rejection paths (missing/expired/wrong-audience), prompt assembly parity with current client behavior (existing prompt tests extend to the server module — the prompt builders move, not change).
- Integration: full interview loop (text + voice) against a real dev deployment with the key absent from the bundle (grep the built assets for the key as a CI-able check).
- Voice-specific: `goAway` reconnect with fresh-token mint under a real >session-limit run (the existing reconnect logic's happy path, now with token refresh).
- Billing: Stripe test-mode checkout → webhook → plan flip → cap raise, and subscription cancellation → downgrade.
- Variants: build with each `VITE_VARIANT` value; assert theme lock, name strings, hidden toggle, correct Stripe price ID.
