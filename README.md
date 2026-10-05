# Paano

Paano is an AI-powered problem-resolution system.

> Tell it what happened. It figures out what comes next.

## Core loop

**Situation → Understanding → Uncertainty → Investigation → Resolution → Reassessment**

The MVP turns a natural-language situation into a structured case containing known facts, unknowns, hypotheses, targeted questions, safety considerations, escalation guidance, and one prioritized next action.

## Stack

- Next.js 15
- React 19
- TypeScript
- CSS
- OpenAI-compatible Chat Completions API

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## AI configuration

Copy `.env.example` to `.env.local` and set:

```env
AI_API_KEY=your_key_here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=your_model_here
```

Do not commit `.env.local` or expose your API key in source control.

## Current MVP limitation

The upload control currently records attachment metadata. Actual image/document content is not yet extracted and supplied to the reasoning engine.

## Current engineering phase

The current version focuses on a deliberate, production-oriented UI for the existing MVP. Backend contracts and reasoning behavior have been preserved.
