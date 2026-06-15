# Pre-Public-Launch Checklist

The HirePrep web app is currently in a **pre-public posture**: usable by you (and
anyone you hand the link to), but deliberately *not* meant for the open internet
yet. This file is the single place that records why, and what to undo/finish
before flipping it public.

> **Date opened:** 2026-06-14 · **Status:** pre-public

## Why we're not public yet

The Gemini API key is read client-side (`import.meta.env.VITE_GEMINI_API_KEY` in
`components/InterviewChat.tsx`, `components/VoiceInterview.tsx`,
`services/geminiService.ts`). Vite inlines `VITE_`-prefixed vars into the built
JavaScript, so **the key ships inside the public bundle** on Vercel. Anyone who
loads the page can extract it and spend against the account. A client-side
password gate does NOT help — the bundle is served before any in-app gate runs.

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
- [ ] Move the key server-side: a Vercel `/api/*` function holds the key as a
      *non*-`VITE_` env var and proxies text/evaluator calls to Gemini.
- [ ] Voice (Live API) opens a WebSocket straight to Google — mint a short-lived
      **ephemeral token** server-side instead of shipping the key.
- [ ] Once the key is no longer in the bundle, remove `VITE_GEMINI_API_KEY` from
      the Vercel build env.

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
