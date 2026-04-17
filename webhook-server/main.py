import os
import math
import stripe
import httpx
import calendar
import asyncio
import json
import uuid as uuid_lib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://boardroom.kreygo.com",
        "https://sim.kreygo.com",
        "https://viewer.kreygo.com",
        "http://localhost:5901",
        "http://localhost:5902",
        "http://localhost:3000",
        "http://localhost:8080",
        "null",  # local file:// pages
    ],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# ── Viewer request static page ────────────────────────────────────────────────
_viewer_dir = Path(__file__).parent.parent / "viewer-request"
if _viewer_dir.exists():
    app.mount("/viewer", StaticFiles(directory=_viewer_dir, html=True), name="viewer")

# ── Stripe ────────────────────────────────────────────────────────────────────
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
ENDPOINT_SECRET = os.environ["STRIPE_ENDPOINT_SECRET"]

# ── ElevenLabs ────────────────────────────────────────────────────────────────
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# ── Gemini ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# ── Stream Control ────────────────────────────────────────────────────────────
STREAMER_TOKEN = os.environ.get("STREAMER_TOKEN", "")
MIN_REQUEST_PRICE_CENTS = int(os.environ.get("MIN_REQUEST_PRICE_CENTS", "200"))
MAX_TIP_CENTS = int(os.environ.get("MAX_TIP_CENTS", "4500"))
SESSION_DURATION_SECONDS = int(os.environ.get("SESSION_DURATION_SECONDS", "900"))
TOPIC_INTRO_SECONDS = int(os.environ.get("TOPIC_INTRO_SECONDS", "60"))
IDLE_BEFORE_FILLER_SECONDS = int(os.environ.get("IDLE_BEFORE_FILLER_SECONDS", "45"))
BREAK_BETWEEN_SESSIONS_SECONDS = int(os.environ.get("BREAK_BETWEEN_SESSIONS_SECONDS", "900"))

# ── Twitch Bot ───────────────────────────────────────────────────────────────
TWITCH_BOT_TOKEN = os.environ.get("TWITCH_BOT_TOKEN", "")
TWITCH_BROADCASTER_TOKEN = os.environ.get("TWITCH_BROADCASTER_TOKEN", "")
TWITCH_CHANNEL = os.environ.get("TWITCH_CHANNEL", "")
TWITCH_CLIENT_ID = os.environ.get("TWITCH_CLIENT_ID", "")
TWITCH_CLIENT_SECRET = os.environ.get("TWITCH_CLIENT_SECRET", "")
MIN_BITS_FOR_TOPIC = int(os.environ.get("MIN_BITS_FOR_TOPIC", "200"))


# ── Supabase Helpers ──────────────────────────────────────────────────────────
def supabase_update(table, data, match_column, match_value):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{match_column}=eq.{match_value}"
    r = httpx.patch(url, json=data, headers=SUPABASE_HEADERS)
    r.raise_for_status()


def supabase_select(table, columns, match_column, match_value):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={columns}&{match_column}=eq.{match_value}"
    r = httpx.get(url, headers=SUPABASE_HEADERS)
    r.raise_for_status()
    return r.json()


def supabase_insert(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = httpx.post(url, json=data, headers=SUPABASE_HEADERS)
    r.raise_for_status()
    result = r.json()
    return result[0] if isinstance(result, list) and result else result


def supabase_select_queue():
    """Get pending topic requests ordered by priority_score DESC, created_at ASC."""
    url = (
        f"{SUPABASE_URL}/rest/v1/topic_requests"
        f"?select=*&status=eq.pending"
        f"&order=priority_score.desc,created_at.asc"
    )
    r = httpx.get(url, headers=SUPABASE_HEADERS)
    r.raise_for_status()
    return r.json()


# ── WebSocket Manager ─────────────────────────────────────────────────────────
class StreamManager:
    def __init__(self):
        self.ws: Optional[WebSocket] = None
        self.is_ready: bool = False
        self.vote_complete_event: asyncio.Event = asyncio.Event()
        self.vote_result: Optional[dict] = None
        self.automation_paused: bool = False
        self.current_request_id: Optional[str] = None
        # Session timer control
        self.force_end_session: bool = False
        self.session_was_skipped: bool = False
        self.session_end_at: Optional[float] = None  # monotonic time
        self.break_end_at: Optional[float] = None    # monotonic time — inter-session break
        # AI Builder autonomous flow
        self.ai_builder_complete_event: asyncio.Event = asyncio.Event()
        # Event listeners for Twitch bot and other subscribers
        self.event_listeners: list = []

    async def broadcast_status(self, text: str):
        await self.send("AGENT_STATUS", {"text": text})

    async def connect(self, ws: WebSocket):
        await ws.accept()
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
        self.ws = ws
        self.is_ready = False

    def disconnect(self):
        self.ws = None
        self.is_ready = False

    async def send(self, cmd: str, payload: dict = None):
        if self.ws:
            msg = {"cmd": cmd}
            if payload is not None:
                msg["payload"] = payload
            try:
                await self.ws.send_json(msg)
            except Exception as e:
                print(f"[WS] Send error: {e}")
                self.ws = None
                self.is_ready = False
        # Notify event listeners (Twitch bot, etc.)
        for listener in self.event_listeners:
            try:
                await listener(cmd, payload)
            except Exception:
                pass


manager = StreamManager()

# Holds full message text for in-flight checkouts (session_id → message).
# Avoids Stripe metadata's 500-char limit while the checkout is pending.
_pending_messages: dict = {}


# ── Gemini Helpers ────────────────────────────────────────────────────────────
async def call_gemini(prompt: str, max_tokens: int = 2048, temperature: float = 0.7) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]


async def call_gemini_with_search(prompt: str, max_tokens: int = 2048, temperature: float = 0.7) -> str:
    """Call Gemini with Google Search grounding enabled for real-time research."""
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        "tools": [{"google_search": {}}],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]


async def moderate_message(message: str) -> bool:
    """Returns True if message is acceptable for the stream."""
    prompt = f"""You are a content moderator for a live stream boardroom simulation show. Evaluate if this viewer topic request is appropriate for a public business/strategy debate.

Topic request: "{message}"

REJECT only if: hate speech, slurs, sexual content, graphic violence, doxxing, or targeted harassment.
ACCEPT anything else — including controversial politics, edgy business ideas, provocative debates.

Respond with ONLY valid JSON: {{"ok": true}} or {{"ok": false, "reason": "brief reason"}}"""
    try:
        result = await call_gemini(prompt, max_tokens=100, temperature=0.1)
        cleaned = result.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        return bool(data.get("ok", True))
    except Exception as e:
        print(f"[Moderation] Error: {e} — failing open")
        return True


# ── Board Setup Agent ─────────────────────────────────────────────────────────
VOICE_IDS = [
    {"id": "Fahco4VZzobUeiPqni1S", "label": "Archer", "gender": "male"},
    {"id": "jRAAK67SEFE9m7ci5DhD", "label": "Ollie", "gender": "male"},
    {"id": "1SM7GgM6IMuvQlz2BwM3", "label": "Mark", "gender": "male"},
    {"id": "kdmDKE6EkgrWrrykO9Qt", "label": "Alexandra", "gender": "female"},
    {"id": "DXFkLCBUTmvXpp2QwZjA", "label": "Eryn", "gender": "female"},
    {"id": "BIvP0GN1cAtSRTxNHnWS", "label": "Ellen", "gender": "female"},
    {"id": "s3TPKV1kjDlVtZbl4Ksh", "label": "Adam", "gender": "male"},
    {"id": "3sfGn775ryaDXhFWHwBg", "label": "Jason", "gender": "male"},
    {"id": "goT3UYdM9bhm0n2lmKQx", "label": "Edward", "gender": "male"},
    {"id": "GsfuR3Wo2BACoxELWyEF", "label": "Cooper", "gender": "male"},
    {"id": "nzeAacJi50IvxcyDnMXa", "label": "Marshal", "gender": "male"},
    {"id": "2gPFXx8pN3Avh27Dw5Ma", "label": "Oxley", "gender": "male"},
    {"id": "kPzsL2i3teMYv0FxEYQ6", "label": "Brittney", "gender": "female"},
    {"id": "q0IMILNRPxOgtBTS4taI", "label": "Drew", "gender": "male"},
    {"id": "m8ysB8KEJV5BeYQnOtWN", "label": "Noor", "gender": "female"},
]

AVAILABLE_MODELS = [
    "google/gemini-2.0-flash-001",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "meta-llama/llama-3.3-70b-instruct",
    "anthropic/claude-3-haiku",
]

AVATAR_COLORS = [
    "bg-blue-600", "bg-red-600", "bg-green-600", "bg-purple-600",
    "bg-yellow-600", "bg-pink-600", "bg-indigo-600", "bg-teal-600",
    "bg-orange-600", "bg-cyan-600",
]


async def run_setup_agent(topic_message: str) -> dict:
    """Generate whiteboard (with search grounding), plus AI builder prompt, opening message, and vote motion."""

    # ── Whiteboard: grounded research call ───────────────────────────────────
    whiteboard_prompt = f"""You are a Boardroom Meeting Prep specialist preparing a live-stream boardroom debate session.

A viewer has submitted this topic: "{topic_message}"

TASK: Conduct thorough research on this topic to find the most recent and relevant news, data, and context. Then write a detailed, comprehensive whiteboard briefing using EXACTLY this format:

SESSION BRIEFING — [TIMESTAMP]
TOPIC: [concise topic title]

SITUATION CONTEXT

How we got here:
- [bullet: founding event or origin of this issue — specific year, names, decisions]
- [bullet: key turning point or escalation that brought this to a head]
- [bullet: any prior attempts to resolve or major failures — what was tried and why it did not work]

What we know right now:
- [bullet: current state of play — who is doing what, right now]
- [bullet: most recent development — with approximate date]
- [bullet: current market/political/regulatory/competitive landscape as it stands today]
- [bullet: any imminent deadlines, events, or catalysts approaching]

Key data points:
- [bullet: specific statistic or figure — e.g. market size, revenue, valuation, user count — with source/date]
- [bullet: second specific data point — growth rate, cost, penetration, etc.]
- [bullet: third data point — competitive benchmark, survey result, analyst estimate, or regulatory figure]
- [bullet: fourth data point if available — financial impact, timeline, percentage]

Stakeholders & interests:
- [bullet: who stands to gain the most and why]
- [bullet: who stands to lose the most and why]
- [bullet: any third-party interests — regulators, customers, employees, partners]

THE CORE ISSUE
[2-3 sentence statement that clearly defines the primary problem or decision the board must resolve, why it is urgent, and what is at stake if they get it wrong]

OPTIONS FOR CONSIDERATION

Option A: [name]
  - What it involves: [2-3 sentences describing the full scope of this option]
  - Why it could work: [2-3 specific reasons with evidence or precedent]
  - Risks and downsides: [2-3 concrete risks, costs, or failure modes]
  - Who supports this: [which stakeholders or interests align with this path]

Option B: [name]
  - What it involves: [2-3 sentences describing the full scope of this option]
  - Why it could work: [2-3 specific reasons with evidence or precedent]
  - Risks and downsides: [2-3 concrete risks, costs, or failure modes]
  - Who supports this: [which stakeholders or interests align with this path]

Option C: [name]
  - What it involves: [2-3 sentences describing the full scope of this option]
  - Why it could work: [2-3 specific reasons with evidence or precedent]
  - Risks and downsides: [2-3 concrete risks, costs, or failure modes]
  - Who supports this: [which stakeholders or interests align with this path]

Option D: [name]
  - What it involves: [2-3 sentences describing the full scope of this option]
  - Why it could work: [2-3 specific reasons with evidence or precedent]
  - Risks and downsides: [2-3 concrete risks, costs, or failure modes]
  - Who supports this: [which stakeholders or interests align with this path]

[Add Option E only if a fifth genuinely distinct alternative exists]

OPEN QUESTIONS FOR THE BOARD
- [bullet: unresolved factual question the board needs answered before deciding]
- [bullet: second open question — ethical, legal, or strategic uncertainty]
- [bullet: third open question — what information is missing or contested]

RULES:
- Use plain text only. No markdown, no asterisks, no hashtags, no backticks.
- Section headers and sub-headers in ALL CAPS as shown above.
- Bullet points with a single hyphen (-) prefix.
- Each bullet must be a full, informative sentence — not a fragment. Be specific and detailed.
- Professional, objective, analytical tone. No fluff or corporate jargon.
- The literal text [TIMESTAMP] must appear on the first line exactly as shown — it will be replaced by the real time programmatically.
- Return ONLY the whiteboard text. No preamble, no explanation, nothing else."""

    whiteboard = await call_gemini_with_search(whiteboard_prompt, max_tokens=3000, temperature=0.5)
    whiteboard = whiteboard.strip()

    # Guard: ensure [TIMESTAMP] token is present for run_session() replacement
    if "[TIMESTAMP]" not in whiteboard:
        whiteboard = "SESSION BRIEFING — [TIMESTAMP]\n\n" + whiteboard

    # ── Other session fields: standard (no search needed) ────────────────────
    meta_prompt = f"""You are a boardroom simulation designer for a live stream show. A viewer has paid to request this topic: "{topic_message}"

Return ONLY valid JSON — no markdown fences, no explanation, no text before or after:
{{
  "ai_builder_prompt": "[1-2 sentences describing what types of board member personas would create the most interesting, clashing debate about this specific topic — name the roles and their angles]",
  "opening_message": "[1-2 sentences establishing the topic and stakes, spoken as the session facilitator to open the debate]",
  "vote_motion": "[A concrete yes/no decision the board must ultimately vote on — specific, actionable, high-stakes]"
}}

Critical: The ai_builder_prompt must be specific to this topic — name roles and their angles so the AI Builder generates the right mix of clashing perspectives."""

    meta_result = await call_gemini(meta_prompt, max_tokens=600, temperature=0.85)
    meta_cleaned = meta_result.strip().replace("```json", "").replace("```", "").strip()
    start = meta_cleaned.find("{")
    end = meta_cleaned.rfind("}") + 1
    meta = json.loads(meta_cleaned[start:end])

    return {
        "whiteboard": whiteboard,
        "ai_builder_prompt": meta["ai_builder_prompt"],
        "opening_message": meta["opening_message"],
        "vote_motion": meta["vote_motion"],
    }


# ── Controller Session Runner ─────────────────────────────────────────────────
async def run_session(request: dict):
    """Process a single topic request end-to-end."""
    req_id = request["id"]
    manager.current_request_id = req_id
    manager.force_end_session = False
    manager.session_was_skipped = False
    manager.vote_result = None
    manager.vote_complete_event.clear()

    viewer_name = request.get("viewer_name", "A viewer")
    print(f"[Controller] Starting session for: {request['message'][:80]}")

    try:
        # Mark processing
        supabase_update("topic_requests", {
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }, "id", req_id)

        # Status: reading topic
        await manager.broadcast_status(f"Reading {viewer_name}'s topic...")

        # Generate setup via Gemini
        print("[Controller] Running setup agent...")
        setup = await run_setup_agent(request["message"])

        # Stamp timestamp into whiteboard
        now_str = datetime.now(timezone.utc).strftime("%a, %b %d %Y, %I:%M %p UTC")
        setup["whiteboard"] = setup["whiteboard"].replace("[TIMESTAMP]", now_str)

        # Persist setup
        supabase_update("topic_requests", {
            "agent_setup": json.dumps(setup)
        }, "id", req_id)

        vote_motion = setup.get("vote_motion", "Should the board approve this initiative?")

        # Reset and load whiteboard
        await manager.send("RESET_SESSION")
        await asyncio.sleep(1.5)
        await manager.broadcast_status("Designing the agenda...")
        await manager.send("SET_WHITEBOARD", {"content": setup["whiteboard"]})
        await asyncio.sleep(0.5)

        # Kick off client-side AI Builder (replaces direct SET_MEMBERS)
        await manager.broadcast_status("Assembling the board...")
        manager.ai_builder_complete_event.clear()
        ai_builder_prompt = setup.get("ai_builder_prompt", f"Generate 5 board members who would debate: {request['message']}")
        await manager.send("RUN_AI_BUILDER", {"prompt": ai_builder_prompt, "auto_select_count": 5})

        # Wait for client to finish running the AI Builder and selecting members
        try:
            await asyncio.wait_for(manager.ai_builder_complete_event.wait(), timeout=60)
            print("[Controller] AI Builder completed")
        except asyncio.TimeoutError:
            print("[Controller] AI Builder timed out, proceeding anyway")

        await asyncio.sleep(1.0)

        # Opening message and start
        await manager.send("SET_INITIAL_MESSAGE", {
            "message": setup["opening_message"],
            "viewer_name": viewer_name,
            "request_text": request["message"],
        })

        # Wait for the topic intro countdown on the client to finish before starting
        await asyncio.sleep(TOPIC_INTRO_SECONDS)

        session_minutes = SESSION_DURATION_SECONDS // 60
        await manager.broadcast_status(f"Discussion starting — {session_minutes} minutes on the clock")
        await manager.send("START_AUTOMODE")

        print(f"[Controller] Automode started. Timer: {SESSION_DURATION_SECONDS}s")

        # Session timer — uses monotonic clock so /streamer/extend can adjust end_at
        loop = asyncio.get_event_loop()
        manager.session_end_at = loop.time() + SESSION_DURATION_SECONDS
        status_pings = {300: False, 60: False}  # remaining_seconds: sent

        # Emit initial timer tick
        await manager.send("SESSION_TIMER", {
            "remaining_seconds": SESSION_DURATION_SECONDS,
            "total_seconds": SESSION_DURATION_SECONDS,
        })

        while loop.time() < manager.session_end_at and not manager.force_end_session:
            remaining = manager.session_end_at - loop.time()
            await asyncio.sleep(min(remaining, 5.0))
            remaining = manager.session_end_at - loop.time()
            if remaining > 0:
                await manager.send("SESSION_TIMER", {
                    "remaining_seconds": int(remaining),
                    "total_seconds": SESSION_DURATION_SECONDS,
                })
                # Milestone status pings
                for threshold, sent in status_pings.items():
                    if not sent and remaining <= threshold:
                        mins = threshold // 60
                        await manager.broadcast_status(f"{mins} minute{'s' if mins > 1 else ''} remaining")
                        status_pings[threshold] = True

        # If skipped, the skip endpoint already handled cleanup
        if manager.session_was_skipped:
            print(f"[Controller] Session skipped, no vote.")
            return

        # End of timer — stop automode, trigger vote
        print("[Controller] Timer expired — ending discussion and calling vote")
        await manager.send("STOP_AUTOMODE")
        await asyncio.sleep(2.0)
        await manager.broadcast_status(f"Calling for a vote: {vote_motion}")
        await manager.send("TRIGGER_VOTE", {"motion": vote_motion})

        # Wait for vote completion (5 min timeout)
        try:
            await asyncio.wait_for(manager.vote_complete_event.wait(), timeout=300)
            print("[Controller] Vote completed")
            result = manager.vote_result or {}
            passed = result.get("passed", False)
            await manager.broadcast_status(f"Motion {'passed' if passed else 'failed'}. Next topic up.")
        except asyncio.TimeoutError:
            print("[Controller] Vote timed out, moving on")

        # Mark done
        supabase_update("topic_requests", {
            "status": "done",
            "ended_at": datetime.now(timezone.utc).isoformat(),
        }, "id", req_id)

        # Broadcast updated queue
        await broadcast_queue()

    except Exception as e:
        print(f"[Controller] Session error: {e}")
        try:
            supabase_update("topic_requests", {"status": "error"}, "id", req_id)
        except Exception:
            pass
    finally:
        manager.current_request_id = None
        manager.session_end_at = None
        loop = asyncio.get_event_loop()
        manager.break_end_at = loop.time() + BREAK_BETWEEN_SESSIONS_SECONDS
        print(f"[Controller] Session ended — break for {BREAK_BETWEEN_SESSIONS_SECONDS}s")
        await manager.send("BREAK_COUNTDOWN", {
            "remaining_seconds": BREAK_BETWEEN_SESSIONS_SECONDS,
            "total_seconds": BREAK_BETWEEN_SESSIONS_SECONDS,
        })


async def broadcast_queue():
    try:
        pending = supabase_select_queue()
        await manager.send("QUEUE_UPDATE", {
            "queue": [
                {
                    "position": i + 1,
                    "viewer_name": r.get("viewer_name", "Anonymous"),
                    "message": r.get("message", ""),
                    "status": r.get("status"),
                }
                for i, r in enumerate(pending)
            ],
            "current_request_id": manager.current_request_id,
            "paused": manager.automation_paused,
            "stream_online": manager.is_ready,
        })
    except Exception as e:
        print(f"[Controller] Queue broadcast error: {e}")


# ── Filler Session (runs when queue is empty) ────────────────────────────────
async def scan_news_for_topic() -> dict:
    """Search today's top news and return 3 debate-worthy stories, ordered best-first."""
    prompt = """You are scanning today's top news to find compelling boardroom debate topics.

Search for the 3 most significant business, technology, or geopolitical news stories from the last 48 hours that would make excellent boardroom debates — meaning: real companies or governments involved, high stakes, and genuine disagreement possible among reasonable people.

Order them best-first: the most debate-worthy story goes at index 0. All three must be distinct stories about different events — do not repeat variations of the same story.

Return ONLY valid JSON — no markdown fences, no explanation, no text before or after:
{
  "stories": [
    {"headline": "Short headline (under 12 words)", "summary": "One sentence: what happened, who is involved, why it matters.", "debate_topic": "The debate topic derived from this story — a short phrase under 15 words"},
    {"headline": "...", "summary": "...", "debate_topic": "..."},
    {"headline": "...", "summary": "...", "debate_topic": "..."}
  ],
  "selected_reason": "One sentence explaining why the first story (index 0) makes the best boardroom debate right now"
}"""

    try:
        result = await call_gemini_with_search(prompt, max_tokens=900, temperature=0.3)
        cleaned = result.strip().replace("```json", "").replace("```", "").strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        data = json.loads(cleaned[start:end])
        stories = data.get("stories") or []
        if not stories or not all(s.get("debate_topic") for s in stories):
            raise ValueError("Missing required fields")
        data["selected_index"] = 0
        data["selected_topic"] = stories[0]["debate_topic"]
        return data
    except Exception as e:
        print(f"[Controller] News scan failed ({e}) — falling back to generated topic")
        fallback_prompt = (
            "Generate a single compelling corporate boardroom discussion topic. "
            "It must be a real business dilemma that a board of directors would genuinely debate — "
            "specific, high-stakes, and controversial enough that reasonable people disagree. "
            "Return ONLY the topic as one sentence under 20 words. No preamble, no punctuation at the end."
        )
        topic = (await call_gemini(fallback_prompt, max_tokens=80, temperature=0.95)).strip().strip(".")
        return {
            "stories": [],
            "selected_index": 0,
            "selected_topic": topic,
            "selected_reason": "",
        }


async def run_filler_session():
    """Autonomous session used when the viewer queue is empty."""
    filler_id = f"filler-{uuid_lib.uuid4().hex[:8]}"
    manager.current_request_id = filler_id
    manager.force_end_session = False
    manager.session_was_skipped = False
    manager.vote_result = None
    manager.vote_complete_event.clear()

    try:
        # Scan news BEFORE resetting the screen — audience watches the process live
        await manager.broadcast_status("Scanning today's headlines…")
        scan = await scan_news_for_topic()
        topic = scan["selected_topic"]
        selected_index = scan.get("selected_index", 0)
        print(f"[Controller] Filler topic from news scan: {topic}")

        # Queue the runner-up stories so the next filler cycles don't re-scan
        # and end up picking the same headline over and over.
        extra_stories = [
            s for i, s in enumerate(scan.get("stories", []))
            if i != selected_index and s.get("debate_topic")
        ]
        if extra_stories:
            try:
                now_iso = datetime.now(timezone.utc).isoformat()
                for s in extra_stories:
                    supabase_insert("topic_requests", {
                        "id": str(uuid_lib.uuid4()),
                        "viewer_name": "Headlines",
                        "message": s["debate_topic"],
                        "base_amount": 0,
                        "tip_amount": 0,
                        "priority_score": -1.0,
                        "stripe_session_id": None,
                        "status": "pending",
                        "created_at": now_iso,
                    })
                print(f"[Controller] Queued {len(extra_stories)} runner-up news topics")
                await broadcast_queue()
            except Exception as e:
                print(f"[Controller] Failed to queue extra news topics: {e}")

        # Show the found stories to the audience (old session still visible behind)
        if scan.get("stories"):
            await manager.send("NEWS_SCAN", {
                "stories": scan["stories"],
                "selected_index": selected_index,
                "selected_reason": scan.get("selected_reason", ""),
                "selected_topic": topic,
            })
            await manager.broadcast_status(f"Selected: {topic}")
            await asyncio.sleep(8.0)  # let audience read the stories

        await manager.broadcast_status("Preparing agenda…")
        setup = await run_setup_agent(topic)

        now_str = datetime.now(timezone.utc).strftime("%a, %b %d %Y, %I:%M %p UTC")
        setup["whiteboard"] = setup["whiteboard"].replace("[TIMESTAMP]", now_str)
        vote_motion = setup.get("vote_motion", "Should the board approve this initiative?")

        await manager.send("RESET_SESSION")
        await asyncio.sleep(1.5)
        await manager.broadcast_status("Designing the agenda…")
        await manager.send("SET_WHITEBOARD", {"content": setup["whiteboard"]})
        await asyncio.sleep(0.5)

        await manager.broadcast_status("Assembling the board…")
        manager.ai_builder_complete_event.clear()
        ai_builder_prompt = setup.get("ai_builder_prompt", f"Generate 5 board members who would debate: {topic}")
        await manager.send("RUN_AI_BUILDER", {"prompt": ai_builder_prompt, "auto_select_count": 5})

        try:
            await asyncio.wait_for(manager.ai_builder_complete_event.wait(), timeout=60)
            print("[Controller] Filler AI Builder completed")
        except asyncio.TimeoutError:
            print("[Controller] Filler AI Builder timed out, proceeding anyway")

        await asyncio.sleep(1.0)

        await manager.send("SET_INITIAL_MESSAGE", {
            "message": setup["opening_message"],
            "viewer_name": "The Board",
            "request_text": topic,
        })

        # Wait for the topic intro countdown on the client to finish before starting
        await asyncio.sleep(TOPIC_INTRO_SECONDS)

        session_minutes = SESSION_DURATION_SECONDS // 60
        await manager.broadcast_status(f"Autonomous discussion starting — {session_minutes} min on the clock")
        await manager.send("START_AUTOMODE")

        loop = asyncio.get_event_loop()
        manager.session_end_at = loop.time() + SESSION_DURATION_SECONDS
        status_pings = {300: False, 60: False}

        await manager.send("SESSION_TIMER", {
            "remaining_seconds": SESSION_DURATION_SECONDS,
            "total_seconds": SESSION_DURATION_SECONDS,
        })

        while loop.time() < manager.session_end_at and not manager.force_end_session:
            remaining = manager.session_end_at - loop.time()
            await asyncio.sleep(min(remaining, 5.0))
            remaining = manager.session_end_at - loop.time()
            if remaining > 0:
                await manager.send("SESSION_TIMER", {
                    "remaining_seconds": int(remaining),
                    "total_seconds": SESSION_DURATION_SECONDS,
                })
                for threshold, sent in status_pings.items():
                    if not sent and remaining <= threshold:
                        mins = threshold // 60
                        await manager.broadcast_status(f"{mins} minute{'s' if mins > 1 else ''} remaining")
                        status_pings[threshold] = True

        if manager.session_was_skipped:
            print("[Controller] Filler session skipped.")
            return

        print("[Controller] Filler timer expired — calling vote")
        await manager.send("STOP_AUTOMODE")
        await asyncio.sleep(2.0)
        await manager.broadcast_status(f"Calling for a vote: {vote_motion}")
        await manager.send("TRIGGER_VOTE", {"motion": vote_motion})

        try:
            await asyncio.wait_for(manager.vote_complete_event.wait(), timeout=300)
            result = manager.vote_result or {}
            passed = result.get("passed", False)
            await manager.broadcast_status(f"Motion {'passed' if passed else 'failed'}. Checking the queue…")
        except asyncio.TimeoutError:
            print("[Controller] Filler vote timed out")

        await broadcast_queue()

    except Exception as e:
        print(f"[Controller] Filler session error: {e}")
    finally:
        manager.current_request_id = None
        manager.session_end_at = None
        loop = asyncio.get_event_loop()
        manager.break_end_at = loop.time() + BREAK_BETWEEN_SESSIONS_SECONDS
        print(f"[Controller] Filler session ended — break for {BREAK_BETWEEN_SESSIONS_SECONDS}s")
        await manager.send("BREAK_COUNTDOWN", {
            "remaining_seconds": BREAK_BETWEEN_SESSIONS_SECONDS,
            "total_seconds": BREAK_BETWEEN_SESSIONS_SECONDS,
        })


# ── Controller Background Loop ────────────────────────────────────────────────
async def controller_loop():
    print("[Controller] Background loop started")
    idle_since: Optional[float] = None
    loop = asyncio.get_event_loop()

    while True:
        await asyncio.sleep(5)

        if not manager.ws or not manager.is_ready:
            idle_since = None
            continue
        if manager.automation_paused:
            idle_since = None
            continue
        if manager.current_request_id:
            idle_since = None
            continue  # session in progress

        # Inter-session break — hold off until break_end_at passes
        if manager.break_end_at:
            now = loop.time()
            remaining = manager.break_end_at - now
            if remaining > 0:
                await manager.send("BREAK_COUNTDOWN", {
                    "remaining_seconds": int(remaining),
                    "total_seconds": BREAK_BETWEEN_SESSIONS_SECONDS,
                })
                idle_since = None
                continue
            else:
                manager.break_end_at = None
                await manager.send("BREAK_COUNTDOWN", {"remaining_seconds": 0, "total_seconds": BREAK_BETWEEN_SESSIONS_SECONDS})

        try:
            pending = supabase_select_queue()
        except Exception as e:
            print(f"[Controller] Queue poll error: {e}")
            continue

        if pending:
            idle_since = None
            asyncio.create_task(run_session(pending[0]))
        else:
            # Queue is empty — start a filler session after a short idle grace period
            # so the vote-results screen has time to be seen before we reset.
            now = loop.time()
            if idle_since is None:
                idle_since = now
                print(f"[Controller] Queue empty — filler starts in {IDLE_BEFORE_FILLER_SECONDS}s")
            elif now - idle_since >= IDLE_BEFORE_FILLER_SECONDS:
                idle_since = None  # reset so the next filler isn't immediate
                asyncio.create_task(run_filler_session())


@app.on_event("startup")
async def startup():
    asyncio.create_task(controller_loop())

    # Start Twitch bot if credentials are configured
    if TWITCH_BOT_TOKEN and TWITCH_CHANNEL:
        from twitch_bot import create_twitch_bot

        async def _run_twitch_bot():
            bot = create_twitch_bot(
                manager=manager,
                gemini_fn=call_gemini,
                supabase_select_queue_fn=supabase_select_queue,
                config={
                    "token": TWITCH_BOT_TOKEN,
                    "channel": TWITCH_CHANNEL,
                    "client_id": TWITCH_CLIENT_ID,
                    "client_secret": TWITCH_CLIENT_SECRET,
                    "broadcaster_token": TWITCH_BROADCASTER_TOKEN,
                    "streamer_token": STREAMER_TOKEN,
                    "min_bits": MIN_BITS_FOR_TOPIC,
                    "server_port": 8901,
                },
            )
            while True:
                try:
                    await bot.start()
                except Exception as e:
                    print(f"[TwitchBot] Crashed: {e} — restarting in 10s")
                    await asyncio.sleep(10)

        asyncio.create_task(_run_twitch_bot())
        print(f"[TwitchBot] Starting for channel #{TWITCH_CHANNEL}")
    else:
        print("[TwitchBot] Skipped — TWITCH_BOT_TOKEN or TWITCH_CHANNEL not set")


# ── WebSocket Endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws/boardroom-control")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    print("[WS] Frontend connected")
    try:
        while True:
            data = await ws.receive_json()
            event = data.get("event")

            if event == "READY":
                manager.is_ready = True
                print("[WS] Frontend ready")
                await broadcast_queue()

            elif event == "VOTE_COMPLETED":
                manager.vote_result = data.get("payload")
                manager.vote_complete_event.set()
                print(f"[WS] Vote completed")

            elif event == "AI_BUILDER_COMPLETED":
                manager.ai_builder_complete_event.set()
                print("[WS] AI Builder completed")

            elif event == "AUTOMODE_STOPPED":
                print("[WS] Automode stopped event received")

    except WebSocketDisconnect:
        print("[WS] Frontend disconnected")
        manager.disconnect()
    except Exception as e:
        print(f"[WS] Error: {e}")
        manager.disconnect()


# ── Streamer Auth ─────────────────────────────────────────────────────────────
def verify_streamer(request: Request):
    if not STREAMER_TOKEN:
        return  # no token configured — open (dev mode)
    token = request.headers.get("X-Streamer-Token", "")
    if token != STREAMER_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── Streamer Control Endpoints ────────────────────────────────────────────────
@app.post("/streamer/skip")
async def streamer_skip(request: Request):
    verify_streamer(request)
    if not manager.current_request_id:
        raise HTTPException(status_code=400, detail="No active session")

    req_id = manager.current_request_id
    refunded = False

    # Auto-refund via Stripe
    try:
        rows = supabase_select("topic_requests", "stripe_session_id", "id", req_id)
        if rows and rows[0].get("stripe_session_id"):
            session_obj = stripe.checkout.Session.retrieve(rows[0]["stripe_session_id"])
            pi = session_obj.get("payment_intent")
            if pi:
                stripe.Refund.create(payment_intent=pi)
                refunded = True
                print(f"[Streamer] Refunded payment for request {req_id}")
    except Exception as e:
        print(f"[Streamer] Refund error: {e}")

    # Mark skipped
    supabase_update("topic_requests", {
        "status": "skipped",
        "ended_at": datetime.now(timezone.utc).isoformat(),
    }, "id", req_id)

    # Signal session to exit without vote
    manager.session_was_skipped = True
    manager.force_end_session = True
    await manager.send("STOP_AUTOMODE")

    return {"status": "skipped", "refunded": refunded}


@app.post("/streamer/end-now")
async def streamer_end_now(request: Request):
    verify_streamer(request)
    if not manager.current_request_id:
        raise HTTPException(status_code=400, detail="No active session")
    manager.force_end_session = True
    return {"status": "ending"}


@app.post("/streamer/extend")
async def streamer_extend(request: Request):
    verify_streamer(request)
    body = await request.json()
    extra_seconds = int(body.get("seconds", 300))

    if manager.session_end_at is None:
        raise HTTPException(status_code=400, detail="No active session timer")

    manager.session_end_at += extra_seconds
    await manager.send("EXTEND_TIMER", {"seconds": extra_seconds})

    # Immediately push a fresh timer tick so the client resyncs
    loop = asyncio.get_event_loop()
    remaining = int(manager.session_end_at - loop.time())
    await manager.send("SESSION_TIMER", {
        "remaining_seconds": max(0, remaining),
        "total_seconds": SESSION_DURATION_SECONDS,
    })

    return {"status": "extended", "seconds": extra_seconds}


@app.post("/streamer/inject-topic")
async def inject_topic(request: Request):
    """Inject a topic directly into the queue — bypasses Stripe for testing."""
    verify_streamer(request)
    body = await request.json()
    viewer_name = (body.get("viewer_name") or "Test Viewer")[:50].strip()
    message = (body.get("message") or "").strip()[:1000]
    if not message:
        raise HTTPException(status_code=400, detail="message required")

    supabase_insert("topic_requests", {
        "id": str(uuid_lib.uuid4()),
        "viewer_name": viewer_name,
        "message": message,
        "base_amount": MIN_REQUEST_PRICE_CENTS,
        "tip_amount": 0,
        "priority_score": 0.0,
        "stripe_session_id": None,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await broadcast_queue()
    return {"status": "queued", "viewer_name": viewer_name, "message": message}


# ── Twitch Bot Topic Submission ──────────────────────────────────────────────
@app.post("/twitch-topic")
async def twitch_topic(request: Request):
    """Submit a topic from the Twitch bot (bits or channel points)."""
    body = await request.json()
    viewer_name = (body.get("viewer_name") or "Anonymous")[:50].strip()
    message = (body.get("message") or "").strip()[:1000]
    source = body.get("source", "channel_points")  # "bits" or "channel_points"
    bits = int(body.get("bits", 0))
    if not message:
        raise HTTPException(status_code=400, detail="message required")

    is_ok = await moderate_message(message)
    if not is_ok:
        return {"status": "rejected", "reason": "content guidelines"}

    # Bits: base = MIN_BITS_FOR_TOPIC cents, tip = bits above minimum
    # Channel Points: free path, lowest priority
    if source == "bits":
        base_amount = MIN_BITS_FOR_TOPIC
        tip_amount = max(0, bits - MIN_BITS_FOR_TOPIC)
        priority_score = float(tip_amount)
    else:
        base_amount = 0
        tip_amount = 0
        priority_score = 0.0

    supabase_insert("topic_requests", {
        "id": str(uuid_lib.uuid4()),
        "viewer_name": viewer_name,
        "message": message,
        "base_amount": base_amount,
        "tip_amount": tip_amount,
        "priority_score": priority_score,
        "stripe_session_id": None,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await broadcast_queue()
    return {
        "status": "queued", "viewer_name": viewer_name, "message": message,
        "source": source, "bits": bits, "priority_score": priority_score,
    }


@app.post("/streamer/pause")
async def streamer_pause(request: Request):
    verify_streamer(request)
    manager.automation_paused = True
    return {"status": "paused"}


@app.post("/streamer/resume")
async def streamer_resume(request: Request):
    verify_streamer(request)
    manager.automation_paused = False
    return {"status": "resumed"}


# ── Public Config Endpoint ────────────────────────────────────────────────────
@app.get("/config")
async def get_config():
    return {
        "min_cents": MIN_REQUEST_PRICE_CENTS,
        "max_tip_cents": MAX_TIP_CENTS,
    }


# ── Public Queue Endpoint ─────────────────────────────────────────────────────
@app.get("/queue")
async def get_queue():
    try:
        pending = supabase_select_queue()
        return {
            "queue": [
                {
                    "position": i + 1,
                    "viewer_name": r.get("viewer_name", "Anonymous"),
                    "message": r.get("message", ""),
                }
                for i, r in enumerate(pending)
            ],
            "stream_online": manager.is_ready,
            "paused": manager.automation_paused,
            "current": manager.current_request_id is not None,
        }
    except Exception:
        return {"queue": [], "stream_online": False, "paused": False, "current": False}


# ── Viewer Topic Checkout ─────────────────────────────────────────────────────
@app.post("/create-topic-checkout")
async def create_topic_checkout(request: Request):
    body = await request.json()
    viewer_name = (body.get("viewer_name") or "Anonymous")[:50].strip()
    message = (body.get("message") or "").strip()[:1000]
    base_cents = int(body.get("base_cents", MIN_REQUEST_PRICE_CENTS))
    tip_cents = max(0, int(body.get("tip_cents", 0)))
    success_url = body.get("success_url", "http://localhost:8080/success.html")
    cancel_url = body.get("cancel_url", "http://localhost:8080")

    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    total_cents = base_cents + tip_cents
    if total_cents < MIN_REQUEST_PRICE_CENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum amount is ${MIN_REQUEST_PRICE_CENTS // 100}",
        )

    # Content moderation (before charging)
    is_ok = await moderate_message(message)
    if not is_ok:
        raise HTTPException(
            status_code=400,
            detail="This topic doesn't meet our content guidelines. Please try a different topic.",
        )

    # Create Stripe Checkout
    try:
        checkout = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "Boardroom Topic Request",
                        "description": f'Topic: "{message[:100]}"',
                    },
                    "unit_amount": total_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            metadata={
                "type": "topic_request",
                "viewer_name": viewer_name,
                "message": message[:500],  # Stripe metadata limit is 500 chars
                "base_cents": str(base_cents),
                "tip_cents": str(tip_cents),
            },
        )
        # Cache the full message so the webhook can retrieve it even if >500 chars
        _pending_messages[checkout.id] = message
        return {"checkout_url": checkout.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Stripe Webhook ────────────────────────────────────────────────────────────
@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, ENDPOINT_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        metadata = data.get("metadata", {})

        # ── Topic request payment ──
        if metadata.get("type") == "topic_request":
            viewer_name = metadata.get("viewer_name", "Anonymous")
            session_id = data.get("id", "")
            # Use cached full message if available; fall back to (potentially truncated) metadata
            message = _pending_messages.pop(session_id, None) or metadata.get("message", "")
            base_cents = int(metadata.get("base_cents", MIN_REQUEST_PRICE_CENTS))
            tip_cents = int(metadata.get("tip_cents", 0))
            priority_score = float(tip_cents)  # higher tip = higher queue priority

            supabase_insert("topic_requests", {
                "id": str(uuid_lib.uuid4()),
                "viewer_name": viewer_name,
                "message": message,
                "base_amount": base_cents,
                "tip_amount": tip_cents,
                "priority_score": priority_score,
                "stripe_session_id": data.get("id"),
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            print(f"[Stripe] Topic request queued: {viewer_name} — {message[:60]}")
            await broadcast_queue()
            return {"status": "queued"}

        # ── Subscription upgrade ──
        user_id = data.get("client_reference_id")
        if not user_id:
            print("WARNING: checkout.session.completed with no client_reference_id")
            return {"status": "ignored"}

        new_plan = data.get("metadata", {}).get("plan", "pioneer")
        if new_plan not in ("pro", "pioneer"):
            new_plan = "pioneer"

        stripe_customer_id = data.get("customer")
        print(f"[Stripe] Upgrading user {user_id} to {new_plan}")
        supabase_update(
            "profiles",
            {"plan": new_plan, "stripe_customer_id": stripe_customer_id},
            "id", user_id,
        )

    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")

        rows = supabase_select("profiles", "id", "stripe_customer_id", customer_id)
        if not rows:
            customer = stripe.Customer.retrieve(customer_id)
            email = customer.get("email")
            if email:
                rows = supabase_select("profiles", "id", "email", email)

        if rows:
            user_id = rows[0]["id"]
            print(f"[Stripe] Downgrading user {user_id} to free")
            supabase_update("profiles", {"plan": "free"}, "id", user_id)
        else:
            print(f"WARNING: Could not find profile for stripe customer {customer_id}")

    return {"status": "ok"}


# ── Existing Endpoints ────────────────────────────────────────────────────────
@app.post("/create-portal-session")
async def create_portal_session(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    rows = supabase_select("profiles", "stripe_customer_id", "id", user_id)
    if not rows or not rows[0].get("stripe_customer_id"):
        raise HTTPException(status_code=404, detail="No billing account found. Please contact support.")

    session = stripe.billing_portal.Session.create(
        customer=rows[0]["stripe_customer_id"],
        return_url="https://boardroom.kreygo.com",
    )
    return {"url": session.url}


@app.post("/tts")
async def tts_proxy(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    voice_id = body.get("voice_id")
    text = body.get("text", "").strip()

    if not user_id or not voice_id or not text:
        raise HTTPException(status_code=400, detail="user_id, voice_id, and text required")
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="TTS not configured on server")

    rows = supabase_select("profiles", "id,messages_used", "id", user_id)
    if not rows:
        raise HTTPException(status_code=403, detail="User not found")

    async with httpx.AsyncClient(timeout=30.0) as client:
        el_res = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"},
            json={
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
        )
        if not el_res.is_success:
            print(f"ElevenLabs error {el_res.status_code}: {el_res.text}")
            raise HTTPException(status_code=502, detail=f"ElevenLabs error: {el_res.status_code}")
        audio_bytes = el_res.content

    try:
        tts_credits = math.ceil(len(text) / 500)
        current = rows[0].get("messages_used") or 0
        supabase_update("profiles", {"messages_used": current + tts_credits}, "id", user_id)
    except Exception as e:
        print(f"WARNING: failed to deduct TTS credits for {user_id}: {e}")

    return Response(content=audio_bytes, media_type="audio/mpeg")


PLAN_CREDIT_LIMITS = {
    "free": 50,
    "pro": 500,
    "pioneer": None,
}


@app.post("/use-message")
async def use_message(request: Request):
    body = await request.json()
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    rows = supabase_select("profiles", "plan,messages_used,billing_cycle_anchor", "id", user_id)
    if not rows:
        raise HTTPException(status_code=403, detail="User not found")

    profile = rows[0]
    plan = profile.get("plan", "free")
    messages_used = profile.get("messages_used") or 0
    billing_cycle_anchor = profile.get("billing_cycle_anchor")

    if billing_cycle_anchor:
        anchor = datetime.fromisoformat(billing_cycle_anchor.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        next_month = anchor.month + 1
        next_year = anchor.year + (1 if next_month > 12 else 0)
        next_month = next_month if next_month <= 12 else 1
        last_day = calendar.monthrange(next_year, next_month)[1]
        next_reset = anchor.replace(
            year=next_year, month=next_month, day=min(anchor.day, last_day)
        )
        if now >= next_reset:
            messages_used = 0
            supabase_update(
                "profiles",
                {"messages_used": 0, "billing_cycle_anchor": now.isoformat()},
                "id", user_id,
            )

    limit = PLAN_CREDIT_LIMITS.get(plan)
    if limit is not None and messages_used >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Credit limit reached ({limit} for {plan} plan)",
        )

    new_count = messages_used + 1
    supabase_update("profiles", {"messages_used": new_count}, "id", user_id)
    return {"allowed": True, "messages_used": new_count}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8901)
