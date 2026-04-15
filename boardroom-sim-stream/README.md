# Boardroom Simulator - Stream Edition

A multi-agent AI boardroom simulator built for **live streaming**. Board members are AI agents powered by Gemini and OpenRouter that discuss, debate, vote, and collaborate in real time.

This is a fork of the main Boardroom Simulator. The key difference: **auto-mode has no turn limit and no credit cap** - the board keeps talking indefinitely, making it suitable for long-form streams.

## Stack

- React 19 + Vite
- Tailwind CSS
- Supabase (auth + data persistence)
- Google Gemini API (orchestration + research)
- OpenRouter (board member agents)

## Key Difference from Main Version

The main app pauses auto-mode after 20 turns and enforces plan-based credit limits. This version removes both restrictions - auto-mode runs until manually stopped.

Changed files:
- `src/hooks/useAutoMode.js` - turn limit and credit check removed
- `src/lib/constants.js` - `AUTO_MODE_TURN_LIMIT` removed

## Setup

### 1. Install Node.js (Windows Server)

```powershell
winget install OpenJS.NodeJS
```

Then open a new terminal and verify:

```powershell
node --version
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a `.env` file in the project root

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
```

### 4. Build for production

```bash
npm run build
```

This outputs a static site to the `dist/` folder. Serve that with nginx or any static file server.

### 4b. Run dev server (optional)

```bash
npm run dev
```

## Features

- Configurable board members with distinct roles, personalities, and AI models
- Orchestrator agent that manages speaking order and meeting flow
- Auto-mode for hands-free continuous discussion (no turn limit)
- Live voting system
- Optional web research during discussions
- Collaborative document editing by board members
- Board templates for quick setup
- Text-to-speech (headphones mode) for audio output
