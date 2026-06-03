# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HirePrep AI is a React-based interview preparation platform that uses Google's Gemini AI models to conduct mock interviews and provide feedback. The app supports both text-based chat interviews and real-time voice interviews with live audio streaming.

Originally exported from AI Studio: https://ai.studio/apps/drive/1TIYx1gtieBIFb6y3jSJE7cKMYSZKVIx4

## Development Commands

**Install dependencies:**
```bash
npm install
```

**Run development server:**
```bash
npm run dev
```
The app runs on `http://localhost:3000` (configured in vite.config.ts)

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## Environment Setup

The app requires a Gemini API key:
- Set `VITE_GEMINI_API_KEY` in `.env.local`
- Access via `import.meta.env.VITE_GEMINI_API_KEY` (standard Vite pattern)

## Architecture

### Core Application Flow (App.tsx)

The app uses a stage-based state machine defined by the `AppStage` enum:

1. **LANDING** - Dashboard with history of past interviews
2. **RESUME_UPLOAD** - User inputs resume, role, and experience level
3. **INTERVIEW_MODE** - User chooses voice or text interview
4. **INTERVIEWING_TEXT** - Chat-based interview using `InterviewChat` component
5. **INTERVIEWING_VOICE** - Live audio interview using `VoiceInterview` component
6. **FEEDBACK** - AI-generated performance analysis and transcript

Interview history persists to localStorage under key `hireprep_history_v1`.

### Gemini Models (constants.ts)

The app uses three different Gemini models for different purposes:

- **TEXT_CHEF**: `gemini-3-flash-preview` - Text-based chat interviews
- **VOICE_INTERVIEWER**: `gemini-2.5-flash-native-audio-preview-09-2025` - Real-time voice with audio streaming
- **EVALUATOR**: `gemini-3-pro-preview` - Generates feedback with structured JSON output

### Voice Interview Architecture (VoiceInterview.tsx)

The voice interview component uses Gemini's Live API with bidirectional audio streaming:

**Audio Processing Chain:**
1. User's microphone input → 16kHz PCM encoding
2. Continuous streaming to Gemini Live API via `sendRealtimeInput`
3. AI response audio (24kHz) decoded and queued for playback
4. Transcriptions accumulated in background buffers
5. Text buffers flushed to transcript on `turnComplete` events

**Key Technical Details:**
- Two separate AudioContext instances (input: 16kHz, output: 24kHz)
- Audio playback uses buffering with `nextStartTimeRef` to prevent gaps
- Interruption handling: stops all playing audio sources when user speaks
- Transcription is collected asynchronously to avoid blocking audio pipeline
- Volume visualization driven by RMS calculation from input samples
- Enhanced audio capture with echo cancellation, noise suppression, and auto gain control
- Initialization guard (`isInitializedRef`) prevents duplicate session creation in React strict mode

### Text Interview Architecture (InterviewChat.tsx)

Uses Gemini's Chat API (`ai.chats.create`) with a persistent conversation thread. The chat is initialized with system instructions including the candidate's resume, role, and experience level.

### Feedback Generation (geminiService.ts)

Uses structured output with a JSON schema to ensure consistent feedback format:
- `score` (number 0-100)
- `strengths` (array of strings)
- `improvements` (array of strings)
- `detailedAnalysis` (string)

The EVALUATOR model receives the full resume data and interview transcript.

## Data Types (types.ts)

Core interfaces:
- **ResumeData** - Resume text, target role, experience level
- **InterviewMessage** - Chat messages with role (user/assistant), content, timestamp
- **InterviewFeedback** - Structured feedback from AI evaluator
- **HistoryEntry** - Complete record of an interview session with resume, transcript, and feedback

## System Instructions (constants.ts)

Both `SYSTEM_INSTRUCTION_INTERVIEWER` and `SYSTEM_INSTRUCTION_FEEDBACK` enforce **English language output** regardless of user input language. The interviewer conducts 5-7 questions mixing behavioral (STAR method) and technical questions.

## Technical Stack

- React 19 with TypeScript
- Vite for build tooling
- Google GenAI SDK (`@google/genai`) for all AI interactions
- Web Audio API for voice processing
- Tailwind CSS classes for styling (utility-first approach)
- LocalStorage for persistence
