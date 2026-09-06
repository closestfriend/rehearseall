# RehearseAll

Rehearse conversations, interviews, demonstrations, and structured assessments
before they happen. RehearseAll supports live voice or text sessions, adaptive
follow-up questions, repeatable assessment decks, session history, and an
outcome-aware debrief.

## Run locally

Prerequisites: Node.js and a Gemini API key.

1. Install dependencies with `npm install`.
2. Set `GEMINI_API_KEY` in `.env.local`.
3. Start the web app and local API routes with `npm run dev:full`.

The terminal prints the local URL. Plain `npm run dev` serves only the browser
application and will not provide the `/api` routes unless `VITE_API_BASE` points
to a deployed backend.

## Custom Rehearsals

Choose **Browse rehearsals** from the home screen to open the reusable rehearsal
library. The seeded Practice collection contains the 43 formats
visible in the source dashboard screenshots:

- 30 adaptive interviews that run through the existing voice or text engine;
- 13 structured assessment formats that generate a fresh practice deck;
- optional live screen sharing for demonstrations, design, code review, system
  design, data science, and specialized programming sessions.

Long assessments use an eight-question practice cut by default. Shorter formats
retain the listed question count. Media assessment prompts use explicitly
labeled simulated stimuli in this prototype.

The Practice collection is an independent approximation based on public
format descriptions and dashboard titles. It does not contain official or
confidential questions and is not affiliated with or endorsed by an assessment provider.

## Screen sharing

Screen sharing is available only in compatible custom voice rehearsals and
requires a browser that implements `navigator.mediaDevices.getDisplayMedia`.
RehearseAll requests video without screen audio and sends a maximum of one JPEG
frame per second to the live rehearsal partner. Stopping the browser share or
ending the rehearsal stops every display track.

## Verification

- `npm test` — run the Vitest suite.
- `npm run build` — compile the production application.
- `npm run check:bundle` — build and scan the client bundle for server-only
  prompt fragments and API-key patterns.
