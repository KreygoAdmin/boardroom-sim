# User Guide — Boardroom Simulator

Boardroom Simulator lets you create AI-powered boardrooms where executive characters debate topics, vote on proposals, conduct research, collaborate on documents, and produce meeting minutes.

---

## Getting Started

### 1. Create an Account

Go to [boardroom.kreygo.com](https://boardroom.kreygo.com) and sign up with your email and password.

### 2. Set Up Your First Board

On first login you'll see the board setup screen. Enter a **purpose**, **budget**, and **timeline** for your meeting, then choose how to configure your board:

- **Start from a template** — pick a pre-built board with members already configured
- **Build manually** — add members one at a time with custom roles and personalities
- **Use AI Builder** — describe the kind of board you want in plain English and let the AI suggest members

### 3. The Tutorial

On first load, a guided tutorial walks you through the key UI elements. Dismiss it at any time or replay it from the settings menu.

---

## Board Templates

Five pre-built boards are available for quick starts:

| Template | Description |
|----------|-------------|
| **Sovereign Triad** | Personal board for wealth preservation and lifestyle optimization (3 members) |
| **Product Launch** | Go-to-market strategy board (5 members) |
| **Crisis Management** | Crisis response and communications board (5 members) |
| **M&A / Due Diligence** | Acquisition evaluation board (5 members) |
| **Blank Board** | Empty slate for fully custom builds |

Each template includes suggested whiteboard prompts to kick off the discussion.

---

## Board Member Settings

Each board member is configurable with:

| Setting | Description |
|---------|-------------|
| Name | Character name |
| Role | Their title (CEO, CFO, CTO, etc.) |
| Avatar | Emoji avatar |
| Personality | Brief description of their character and perspective |
| Model | Which LLM powers them (see model list below) |
| Voice | ElevenLabs voice for text-to-speech (Headphones mode) |
| Agreement | How readily they align with others (affects debate dynamics) |
| Aggression | How combative they are in disagreement |
| Can edit documents | Whether this member can propose or modify shared documents |
| Suppress action requests | Prevents this member from requesting votes, research, or documents |

### Available Models

- **Gemini**: 2.0 Flash (default), 1.5 Pro
- **Claude**: 3.5 Sonnet, 3 Haiku
- **GPT**: GPT-4o, GPT-4o Mini
- **Open**: Llama 3.3 70B, Mistral Large, DeepSeek V3, DeepSeek R1

---

## AI Builder

Open the member config modal and switch to the **AI Builder** tab. Describe the board you want in natural language (e.g. "a skeptical CFO who hates risk and a visionary CMO who pushes growth at all costs") and the AI will suggest fully configured members. Add them with one click.

---

## Member Library

The **Library** tab in the member config modal lets you save and reuse custom members across boardrooms. Saved agents retain their role, personality, model, and voice settings.

- **Free**: up to 5 saved agents
- **Pro**: up to 25 saved agents
- **Pioneer**: unlimited

---

## Running a Meeting

### Sending a Message

Type your topic or question in the input box and press Enter (or click Send). The orchestrator AI will:
1. Pick the most appropriate board member to respond
2. Optionally dispatch a research agent if a factual question is detected
3. Have that member reply in character
4. Update the meeting minutes automatically

### Next Speaker

Click **Next Speaker** in the toolbar to trigger the next AI turn without sending a new message. Useful for nudging the conversation forward without adding new direction.

### Auto-Mode

Toggle **Auto** in the toolbar to let the board run continuously without your input. Auto-mode will stop when:
- You toggle it off
- The turn limit (20 turns) is reached
- A member requests a vote, research, or document action (you'll be prompted to approve)

In Headphones mode, auto-mode waits for audio to finish before moving to the next turn.

### Brief Mode

Toggle **Brief** in the toolbar to make board member responses shorter and more concise. Useful for fast-moving brainstorming sessions.

---

## Board Features

### Whiteboard

The whiteboard (sidebar) is a shared scratchpad for the meeting. Type notes, agendas, or context — all board members reference it throughout the discussion. It saves automatically with the boardroom.

### Meeting Minutes

The minutes panel updates automatically as the meeting progresses. It tracks:

- **Consensus points** — things the board agrees on
- **Friction points** — disagreements or unresolved tensions
- **Momentum** — the direction the discussion is heading
- **Action items** — tasks that have been assigned or decided

### Alignment Stats

Each member's alignment bar shows how much they currently agree with the direction of the meeting. Updated every 3 messages by a dedicated alignment agent.

---

## Auto-Research

When the orchestrator detects a factual question (market data, statistics, regulations, recent events), it can dispatch a research agent that fetches real-time information using Gemini with Google Search grounding. Results appear as a system message with a headline and key findings before the board responds.

You can also manually trigger research by typing a question into the research input field in the toolbar.

---

## Voting

Votes can be triggered automatically (when the orchestrator detects a decision point or deadlock) or manually by describing a motion in the chat.

Votes can be:
- **YES / NO** — binary vote
- **Multi-option** — pick from several alternatives

The vote modal shows each member's vote individually. After closing, a resolution summary is generated and added to the meeting minutes.

---

## Documents

Board members with document editing permission can propose creating or editing shared documents mid-discussion. Documents appear in the sidebar with:

- Full content editable in the panel
- Complete revision history with timestamps and editor names
- Copy to clipboard for export
- Delete with confirmation

In auto-mode, document changes are applied automatically. Outside auto-mode, you'll be prompted to approve or decline each change.

---

## Action Requests

Board members can raise requests mid-discussion:

| Request Type | What it does |
|-------------|--------------|
| **Vote request** | Proposes a formal vote on a specific motion |
| **Research request** | Asks for fact-checking on a topic |
| **Document proposal** | Proposes creating or editing a document |
| **Clarifying question** | Routes a question back to you |

You approve or decline each request. To prevent specific members from making requests, enable **Suppress action requests** in their settings.

---

## Meeting Reports

Click **Report** in the toolbar to generate a full meeting report including:
- Board member roster with roles
- Complete meeting minutes (consensus, friction, momentum, action items)
- Full message transcript with speaker attribution and timestamps
- Voting results with per-member breakdown

The report is formatted in Markdown and can be copied for external documentation.

---

## Voice Playback — Headphones Mode

Enable **Headphones** in the toolbar to have board member messages read aloud using ElevenLabs TTS. Each member has an assigned voice (auto-matched by name). Audio plays sequentially and can be paused. Auto-mode is audio-aware and waits for playback to finish before the next turn.

---

## Managing Multiple Boards

Pro and Pioneer users can create and switch between multiple boardrooms using the board switcher in the sidebar. Each boardroom maintains its own members, conversation history, whiteboard, minutes, and documents.

- **Free**: 1 boardroom
- **Pro**: up to 5 boardrooms
- **Pioneer**: unlimited boardrooms

---

## Settings

Access settings via the gear icon. Options include:

- **API Keys** — Enter your Gemini and OpenRouter keys (stored locally in your browser, never sent to our servers)
- **Response Language** — Change the language all board members respond in
- **Dark Mode** — Toggle theme (persists across sessions)
- **Account / Billing** — Link to billing portal (Pro and Pioneer)
- **Reset Password** — Change your password in-app

---

## Plans

| Feature | Free | Pro | Pioneer |
|---------|------|-----|---------|
| Credits/month | 50 (~15 messages) | 500 | Unlimited |
| Boardrooms | 1 | 5 | Unlimited |
| Members per board | 3 | 10 | Unlimited |
| Saved agents (library) | 5 | 25 | Unlimited |
| Board templates | — | Yes | Yes |
| Voice playback (TTS) | — | — | Yes |
| Price | Free | $15/mo | $50/mo |

Upgrade from the settings menu or the pricing modal.

---

## Tips

- **Give members distinct personalities** — the more differentiated they are, the richer the debate
- **Use the whiteboard before starting** — set an agenda or paste in a brief so the AI has context for the whole meeting
- **Auto-mode + Auto-research** together is powerful for complex topics where you want the board to dig into real data
- **Brief mode** is great for quick brainstorming; turn it off when you want detailed analysis
- **Agreement and aggression stats** matter — a high-aggression, low-agreement CFO will push back hard and create real friction
- **Trigger votes manually** by describing a motion in the chat — the orchestrator will pick it up and formalize it
- **Documents** work well for decisions that need a written output — ask a member to draft a policy, then let others revise it
- **Suppress action requests** on members you want to keep purely reactive if the constant prompts slow you down
