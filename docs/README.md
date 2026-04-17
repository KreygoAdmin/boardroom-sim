# Boardroom Simulator

A multi-agent AI orchestration app that simulates realistic board meeting conversations. Create a custom boardroom with AI-driven executives, give them a topic, and watch them debate, vote, and produce meeting minutes — all in real time.

Live at: **https://boardroom.kreygo.com** 

---

## Project Structure

```
boardroom-sim/
├── boardroom-sim/           # React frontend (public app with plan/credit limits)
├── boardroom-sim-stream/    # React frontend fork (stream build — no turn or credit limits)
├── webhook-server/          # FastAPI backend (Python)
│   ├── main.py              # All server logic
│   ├── schema.sql           # Supabase table definitions
│   ├── requirements.txt
│   └── .env
├── viewer-request/          # Static viewer submission page (topic requests + Stripe)
│   ├── index.html
│   ├── app.js
│   └── success.html
├── landing_page/            # Static marketing landing page
├── docs/                    # This documentation
├── deploy.bat               # Build + restart everything
└── start.bat                # Start all services (tunnel + frontend + backend)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Backend | FastAPI, Uvicorn |
| Database & Auth | Supabase (PostgreSQL + Auth) |
| AI Orchestration | Google Gemini 2.0 Flash (research, setup agent, moderation), OpenRouter (board members, voting, alignment — Claude, GPT-4o, Llama, DeepSeek, Mistral) |
| Text-to-Speech | ElevenLabs (11 voices, proxied through backend) |
| Payments | Stripe (subscriptions + one-time topic request payments) |
| Tunnel | Cloudflare Tunnel |

---

## Core Features

### Boardroom Simulation
- **Board Members** — 4-6 AI agents with configurable names, roles, personalities, agreement/aggression stats, LLM models, and ElevenLabs voices
- **Orchestrator** — decides who speaks next, when to call votes, and when to trigger research
- **Whiteboard** — shared context visible to all agents (project info, goals, budget, etc.)
- **Automode** — fully automated conversation loop; agents debate, research, and vote autonomously
- **Voting** — binary (Yes/No) or multi-option; agents vote in character with reasoning
- **Research Agent** — Gemini with Google Search grounding; triggered by orchestrator or members
- **Documents** — agents can propose and edit collaborative documents mid-meeting
- **Session Minutes** — live-updated consensus, friction, momentum, and action items
- **Alignment System** — tracks each member's agreement score dynamically as the conversation evolves

### AI Builder
- Conversational interface to generate custom board member personas from a scenario description
- Outputs name, role, 4-6 sentence description, stats, model, voice, and avatar

### Plans (Public App)

| Feature | Free | Pro | Pioneer |
|---------|------|-----|---------|
| Messages/month | 50 | 500 | Unlimited |
| Boardrooms | 1 | 5 | Unlimited |
| Board members | 3 | 10 | Unlimited |
| Saved agents | 5 | 25 | Unlimited |
| Board templates | — | ✓ | ✓ |
| Price | $0 | $15/mo | $50/mo |

The **stream build** (`boardroom-sim-stream`) has no turn or credit limits — used for live streaming.

---

## Stream Automation System

The stream build includes a viewer-driven automation system:

### How It Works

```
Viewer page → Stripe payment → Stripe webhook → topic_requests table
                                                        ↓
                                               Controller Agent (Gemini)
                                                        ↓
                                          WebSocket commands → boardroom-sim-stream
                                          (reset → set whiteboard/members → automode)
                                                        ↓
                                          15-min timer → vote → done → next request
```

1. A viewer visits the **viewer-request page**, types a topic, pays (min $5 + optional tip)
2. Gemini screens the message before Stripe checkout is created
3. On payment, the request enters the `topic_requests` queue (higher tip = higher priority)
4. The **controller agent** picks up the next request, calls Gemini to generate board members and whiteboard content tailored to the topic, then drives the stream app via WebSocket
5. Automode runs for a configurable timer (default 15 min), then a vote is automatically triggered
6. After the vote completes, the next queued request starts

### Streamer Controls

Open `localhost:5902/streamer` in a separate window (only accessible on localhost, not visible on stream):

| Control | Action |
|---------|--------|
| End Now → Vote | Immediately ends the discussion and triggers a vote |
| +5 / +10 min | Extends the current session timer |
| Skip + Refund | Skips the current request and auto-refunds the viewer via Stripe |
| Pause / Resume | Halts the automation queue (no new sessions start) |

A small **agent status badge** appears in the bottom-right corner of the app when running on localhost:
- 🟢 `agent: idle` — connected, queue empty
- 🟢 `agent: session active` — topic is live
- 🟡 `agent: 2 in queue` — requests waiting
- 🟡 `agent: paused` — automation paused
- 🔴 `agent: disconnected` — WebSocket not connected

---

## Backend API Endpoints

### Existing

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/webhooks/stripe` | Stripe event handler (plan upgrades, downgrades, topic request payments) |
| `POST` | `/create-portal-session` | Returns Stripe billing portal URL |
| `POST` | `/tts` | ElevenLabs TTS proxy (tracks per-user character usage) |
| `POST` | `/use-message` | Credit limit enforcement + billing cycle reset |
| `GET` | `/health` | Health check |

### Stream Automation

| Method | Path | Purpose |
|--------|------|---------|
| `WS` | `/ws/boardroom-control` | WebSocket: agent → frontend command channel |
| `POST` | `/create-topic-checkout` | Moderate message + create Stripe checkout for viewer request |
| `GET` | `/queue` | Public queue status for viewer page |
| `POST` | `/streamer/skip` | Skip current session + auto-refund |
| `POST` | `/streamer/end-now` | End session early (triggers vote) |
| `POST` | `/streamer/extend` | Add seconds to current session timer |
| `POST` | `/streamer/pause` | Pause automation queue |
| `POST` | `/streamer/resume` | Resume automation queue |

Streamer endpoints require `X-Streamer-Token` header matching `STREAMER_TOKEN` in the server `.env`.

---

## Supabase Tables

**`profiles`** (extends `auth.users`):
```sql
id uuid references auth.users primary key,
plan text default 'free',
stripe_customer_id text,
messages_used integer default 0,
billing_cycle_anchor timestamptz
```

**`boardrooms`**:
```sql
id uuid primary key default gen_random_uuid(),
user_id uuid references auth.users,
name text,
members jsonb,
messages jsonb,
whiteboard text,
settings jsonb,
updated_at timestamptz default now()
```

**`topic_requests`** (stream automation — see `webhook-server/schema.sql`):
```sql
id uuid primary key,
viewer_name text,
message text,
base_amount integer,   -- cents
tip_amount integer,    -- cents
priority_score float,  -- higher = processed first
stripe_session_id text,
status text,           -- pending | processing | done | skipped | error
agent_setup jsonb,     -- whiteboard + members generated by Gemini
created_at timestamptz,
started_at timestamptz,
ended_at timestamptz
```

---

## Environment Variables

### Stream Frontend (`boardroom-sim-stream/.env`)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
VITE_OPENROUTER_API_KEY=
VITE_STREAMER_TOKEN=          # must match server STREAMER_TOKEN
VITE_SESSION_DURATION_SECONDS=900
```

### Backend (`webhook-server/.env`)

```env
STRIPE_ENDPOINT_SECRET=
STRIPE_SECRET_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ELEVENLABS_API_KEY=
GEMINI_API_KEY=
STREAMER_TOKEN=               # secret token for /streamer/* endpoints
MIN_REQUEST_PRICE_CENTS=500   # $5.00 minimum viewer request price
SESSION_DURATION_SECONDS=900  # 15 minutes per discussion
```

---

## Quick Start (Local Dev)

```bash
# Stream frontend
cd boardroom-sim-stream
npm install
npm run dev        # http://localhost:5902
                   # Streamer panel: http://localhost:5902/streamer

# Backend
cd webhook-server
pip install -r requirements.txt
uvicorn main:app --reload --port 8901

# Viewer request page (open directly in browser)
# viewer-request/index.html
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup.

---

## Agent Architecture

All AI calls are non-streaming (complete JSON responses):

| Agent | Model | Purpose |
|-------|-------|---------|
| Orchestrator | Claude 3 Haiku (OpenRouter) | Decides next speaker, session notes, research/vote triggers |
| Board Members | Configurable per-member (GPT-4o, Claude, Gemini, Llama, etc.) | Respond in character with their angle on the topic |
| Research Agent | Gemini 2.0 Flash + Google Search | Retrieves real-world facts and sources |
| Voting Agent | Batch OpenRouter calls | Each member votes with a 5-word reason |
| Resolution Agent | OpenRouter | Writes 2-sentence vote summary |
| Alignment Agent | OpenRouter | Adjusts member agreement scores every 3 messages |
| AI Builder | OpenRouter | Generates custom personas from a scenario description |
| Setup Agent (stream) | Gemini 2.0 Flash | Generates whiteboard + members for a viewer's topic request |
| Moderation (stream) | Gemini 2.0 Flash | Screens viewer messages before Stripe checkout |

### Action Tag Protocol

Board members can embed special tags in their responses to trigger system actions:

```
[REQUEST_VOTE: motion text]
[REQUEST_RESEARCH: query]
[REQUEST_QUESTION: question for the user]
[PROPOSE_DOC: Title | Full document text]
[EDIT_DOC: Title | Updated text | 1-sentence summary]
```

In automode, document actions are applied automatically. Vote/research/question requests surface as UI prompts.
