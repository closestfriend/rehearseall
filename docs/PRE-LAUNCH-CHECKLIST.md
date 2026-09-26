# Pre-Public-Launch Checklist

The HirePrep web app is currently in a **pre-public posture**: usable by you (and
anyone you hand the link to), but deliberately *not* meant for the open internet
yet. This file is the single place that records why, and what to undo/finish
before flipping it public.

> **Date opened:** 2026-06-14 · **Status:** pre-public

## Why we're not public yet

**Update (2026-07-17, gateway branch):** the original reason — the key shipping
in the client bundle — is FIXED. Gemini access goes through `/api` functions;
the key is a server-only `GEMINI_API_KEY` and `npm run check:bundle`
proves the built bundle contains no key or prompt material. The remaining
reason to stay quiet is different: the gateway has **no auth or quota yet**
(phase 1 of `docs/superpowers/specs/2026-07-11-billing-and-variants-design.md`),
so anyone with the URL can spend against the account through the endpoints —
bounded only by the CORS allowlist, a per-session turn ceiling, and input caps.
Phase 2 (sign-in required) closes this; `noindex` stays until then.

## What's in place now (the "keep it quiet" stopgaps)

- [x] `<meta name="robots" content="noindex, nofollow">` in `index.html`
- [x] `public/robots.txt` → `Disallow: /`

These only deter search engines / lazy crawlers. They do **not** protect the key
from a targeted bundle scraper. They exist to buy time, not to secure anything.

## Before public launch — DO

**Remove the stopgaps (or the site will be invisible):**
- [ ] Delete the `noindex` `<meta>` from `index.html`
- [ ] Delete or relax `public/robots.txt`
- [ ] If you turned on Vercel Deployment Protection, turn it off for production

**Actually secure the key (the real fix):**
- [x] Move the key server-side: `/api/chat` + `/api/evaluate` hold the key as
      `GEMINI_API_KEY` and proxy text/evaluator calls to Gemini. *(gateway branch, 2026-07-17)*
- [x] Voice (GPT-Live): `/api/live-session` exchanges WebRTC SDP server-side;
      the OpenAI API key never reaches the browser. *(GPT-Live migration)*
- [ ] Once the gateway branch merges to `main`, remove `VITE_GEMINI_API_KEY`
      from the Vercel build env (production still needs it until the merge).
- [ ] Phase 2 (auth): require sign-in for interviews, closing the
      anonymous-endpoint spend window that replaces the old key-in-bundle risk.

**Harden regardless (do these now, not just at launch):**
- [ ] In Google Cloud Console, restrict the key to the Generative Language API
      only, and set a daily quota cap + billing budget alert (bounds the damage
      if it's already been scraped).
- [ ] Use a dedicated key for this deploy so rotation is one click.
- [ ] **Rotate the key** — assume the current one has been public long enough to
      be compromised.

## Quick reference: what protects what

| Measure | Hides the site | Protects the key |
|---|---|---|
| Obscure URL | barely | no |
| `robots.txt` / `noindex` | from search engines | no |
| In-app (React) password gate | no | **no** (bundle served first) |
| Vercel Deployment Protection (edge) | yes | yes (gates the bundle) |
| Server-side key + ephemeral tokens | n/a | **yes** (key never reaches browser) |
