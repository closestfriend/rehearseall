# RehearseAll

Rehearse conversations, interviews, demonstrations, and structured assessments
before they happen. RehearseAll supports live voice or text sessions, adaptive
follow-up questions, repeatable assessment decks, session history, and an
outcome-aware debrief.

## RehearseAll for Alexa+

Hard conversations go better when you have said the words out loud once.
RehearseAll is an Alexa+ add-on: say "Alexa, help me practice asking for a raise"
(or describe any conversation), talk it through with a counterpart who answers in
character, then ask "how did I do?" for a scorecard on the skills that
conversation needs. It remembers your weakest skill across sessions and suggests
what to rehearse next.

It is built as a self-hosted MCP server, which is how Alexa+ add-ons integrate.

### Try it

Prerequisites: Node.js 20.12+, and an OpenRouter API key (or a Gemini API key).

```bash
npm install
cp .env.example .env.local   # then add OPENROUTER_API_KEY or GEMINI_API_KEY
npm run demo                 # MCP server on :8787, simulated Alexa+ host on :5180
```

Open http://localhost:5180 in Chrome (voice input uses the Web Speech API; you
can also type). Try "What can I rehearse?", "Help me practice asking my manager
for a raise", or "I need to tell my landlord the heating is broken". Speak to the
counterpart, then say "how did I do?". `npm run mcp:reset` clears your history.

### How it works

```
 you ──voice──▶ host (Alexa+ role) ──MCP over Streamable HTTP──▶ RehearseAll server
                │ decides which tool to call                      │ persona + session state
                │ speaks results, renders ui:// cards             │ scoring + progress
                ▼                                                 ▼
          Echo Show-style screen                         mcp/.data/store.json
```

| Tool | What it does |
|---|---|
| `list_scenarios` | Preset hard conversations, plus the one to practice next for your weakest skill |
| `start_rehearsal` | Starts a preset (`scenario_id`) or any conversation (`counterpart` + `goal`), with optional details and a private worry; returns the counterpart's opening line |
| `say_to_counterpart` | Passes what you said, unchanged, and returns the counterpart's in-character reply |
| `finish_rehearsal` | Scores the session per skill with evidence from your own words; shows a scorecard card |
| `get_progress` | Skill averages and trends across sessions, weakest skill, suggested scenario; shows a progress card |

Design choices that follow the Alexa+ model:

- **The persona lives on the server.** Alexa+ routes every utterance and speaks
  the replies itself, so the server keeps the counterpart and the transcript, and
  each tool response is self-contained with a `session_id` to chain on.
- **Cards are MCP Apps.** `finish_rehearsal` and `get_progress` point at
  `ui://rehearseall/*.html` resources (`text/html;profile=mcp-app`) that render
  on screen from the tool result.
- **Stateless transport, persistent memory.** Each HTTP request gets a fresh
  server (MCP spec 2025-11-25, JSON responses, Origin validation); history lives
  in a file, so progress survives restarts.
- **Same prompts as the web app.** The counterpart and evaluator reuse
  RehearseAll's conversation prompts and model routing (`api/_lib`).

### What is real and what is simulated

Alexa+'s add-on tooling (MCP Toolkit, CLI, web simulator) is available to
select partners only, so per the hackathon FAQ this ships with its own web host
that acts as a real MCP client. The MCP server is the real add-on surface; the
host page stands in for Alexa+:

- **Real:** the MCP server, its tools and resources, the protocol traffic (shown
  live in the page's inspector), scoring, and cross-session progress.
- **Simulated:** Alexa+'s routing and voice. An LLM (`mcp/hostBrain.ts`) decides
  which tool to call, and the browser's speech APIs do voice. This shows the
  server works for an LLM host that only sees `tools/list`; it does not show how
  Alexa+ itself would route, voice, or paraphrase.
- **Not built yet:** OAuth 2.1 account linking (Alexa+ needs it for per-user
  memory; the demo uses one local user), and certification assets.
- **Latency:** conversational turns run about 1.5 to 2.5 seconds, within Alexa+'s
  3-second guideline. Scoring takes about 7 seconds, so the host says it is
  scoring first, as Alexa's guidance suggests for slow tools.

Tests: `npx vitest run mcp` drives the server through a real MCP client over an
in-memory transport (tool listing, a full rehearsal, custom rehearsals,
cross-session memory, error handling).

## Web app

### Run locally

Prerequisites: Node.js, a Gemini API key for text/evaluation, and an OpenAI API
key with GPT-Live access for voice sessions and screen-share descriptions.

1. Install dependencies with `npm install`.
2. Set `GEMINI_API_KEY` and `OPENAI_API_KEY` in `.env.local`.
3. Start the web app and local API routes with `npm run dev:full`.

The terminal prints the local URL. Plain `npm run dev` serves only the browser
application and will not provide the `/api` routes unless `VITE_API_BASE` points
to a deployed backend.

## Custom Rehearsals

Choose **Browse rehearsals** from the home screen to open the reusable rehearsal
library. The seeded Practice collection contains 43 formats:

- 30 adaptive interviews that run through the existing voice or text engine;
- 13 structured assessment formats that generate a fresh practice deck;
- optional live screen sharing for demonstrations, design, code review, system
  design, data science, and specialized programming sessions.

Long assessments use an eight-question practice cut by default. Shorter formats
retain the listed question count. Media assessment prompts use explicitly
labeled simulated stimuli in this prototype.

The Practice collection is an independent approximation based on public
format descriptions. It does not contain official or confidential questions and
is not affiliated with or endorsed by any assessment provider.

## Screen sharing

Screen sharing is available only in compatible custom voice rehearsals and
requires a browser that implements `navigator.mediaDevices.getDisplayMedia`.
RehearseAll requests video without screen audio and samples a JPEG frame every
five seconds. A fast vision model summarizes the visible work and passes that
description into the live voice session; raw screen frames are not sent into
GPT-Live's audio stream. Stopping the browser share or ending the rehearsal
stops every display track.

## Verification

- `npm test` — run the Vitest suite.
- `npm run build` — compile the production application.
- `npm run check:bundle` — build and scan the client bundle for server-only
  prompt fragments and API-key patterns.
