"""
Twitch bot for Boardroom Simulator stream.
Runs as an asyncio task inside the FastAPI process (twitchio v2).

Topic submission paths:
  - Bits  (200+ minimum): Cheer with message, or !topic + cheer within 60s
  - Channel Points: Custom reward with text input (requires affiliate)
  - Stripe: Existing web checkout at api.kreygo.com/viewer
"""

import asyncio
import json
import random
import re
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Callable, Awaitable

from twitchio.ext import commands, pubsub


# ── Rate Limiter ─────────────────────────────────────────────────────────────

class RateLimiter:
    """Sliding window rate limiter for Twitch chat (stay under 20 msgs/30s)."""

    def __init__(self, limit: int = 18, window: float = 30.0):
        self.limit = limit
        self.window = window
        self.timestamps: deque = deque()

    def can_send(self) -> bool:
        now = time.monotonic()
        while self.timestamps and now - self.timestamps[0] > self.window:
            self.timestamps.popleft()
        return len(self.timestamps) < self.limit

    def record_send(self):
        self.timestamps.append(time.monotonic())


# ── Bits Correlation State ────────────────────────────────────────────────────

@dataclass
class PendingTopic:
    message: str
    timestamp: float


@dataclass
class PendingCheer:
    bits: int
    timestamp: float


# ── Config Loader ─────────────────────────────────────────────────────────────

def load_bot_config(path: str = None) -> dict:
    if path is None:
        path = str(Path(__file__).parent / "twitch_bot_config.json")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[TwitchBot] Failed to load config: {e} — using defaults")
        return {
            "name": "BoardBot",
            "personality": "You are a helpful stream bot for the Boardroom Simulator.",
            "tone": "friendly, concise",
            "rules": [],
            "catchphrases": [],
            "onboarding_style": "friendly and informative",
            "narration_style": "short and punchy",
            "off_limits": [],
        }


# ── Bot Class ─────────────────────────────────────────────────────────────────

class BoardroomTwitchBot(commands.Bot):

    def __init__(
        self,
        manager,
        gemini_fn: Callable[..., Awaitable[str]],
        supabase_select_queue_fn: Callable,
        submit_topic_url: str,
        config: dict,
    ):
        self.manager = manager
        self.call_gemini = gemini_fn
        self.supabase_select_queue = supabase_select_queue_fn
        self.submit_topic_url = submit_topic_url

        self.channel_name: str = config["channel"]
        self.min_bits: int = config.get("min_bits", 200)
        self.broadcaster_token: str = config.get("broadcaster_token", "")
        self.client_id_str: str = config.get("client_id", "")

        # Personality
        self.bot_config: dict = load_bot_config()

        # Chat buffer for engagement context (rolling last 50 msgs)
        self.chat_buffer: deque = deque(maxlen=50)

        # Events from StreamManager dispatched here
        self.event_queue: asyncio.Queue = asyncio.Queue(maxsize=100)

        # Rate limiter
        self.rate_limiter = RateLimiter(limit=18, window=30.0)

        # Bits correlation
        self.pending_topics: dict[str, PendingTopic] = {}
        self.pending_cheers: dict[str, PendingCheer] = {}
        self.correlation_window: float = 60.0

        # Narration cooldown tracking
        self._last_narration: dict[str, float] = {}
        self._narration_cooldown: float = 10.0

        # Current topic context (updated from stream events)
        self._current_topic: Optional[str] = None
        self._current_viewer: Optional[str] = None

        super().__init__(
            token=config["token"],
            prefix="!",
            initial_channels=[config["channel"]],
            client_secret=config.get("client_secret", ""),
        )

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def event_ready(self):
        print(f"[TwitchBot] Connected as {self.nick} to #{self.channel_name}")

        # Register as a StreamManager event listener
        self.manager.event_listeners.append(self._on_stream_event)

        # Background loops — use asyncio directly (v2 runs on the same loop)
        asyncio.ensure_future(self._onboarding_loop())
        asyncio.ensure_future(self._engagement_loop())
        asyncio.ensure_future(self._status_narrator_loop())
        asyncio.ensure_future(self._correlation_cleanup_loop())

        # PubSub for channel points + bits (optional — requires broadcaster token)
        if self.broadcaster_token:
            asyncio.ensure_future(self._setup_pubsub())

    async def event_message(self, message):
        if message.echo:
            return

        if message.author:
            self.chat_buffer.append({
                "user": message.author.name,
                "text": message.content,
                "time": time.monotonic(),
            })

        await self.handle_commands(message)

    # ── Chat Commands ─────────────────────────────────────────────────────────

    @commands.command(name="topic")
    async def cmd_topic(self, ctx: commands.Context):
        """!topic <message> — Start bits topic submission flow."""
        topic_text = ctx.message.content[len("!topic"):].strip()
        if not topic_text:
            await self._send_chat(
                f"@{ctx.author.name} Usage: !topic <your topic> "
                f"— then Cheer {self.min_bits}+ bits within 60 seconds. "
                f"Or use Channel Points. Or visit api.kreygo.com/viewer"
            )
            return

        username = ctx.author.name.lower()

        # Flow C: cheer came first, !topic confirms it
        if username in self.pending_cheers:
            cheer = self.pending_cheers.pop(username)
            if time.monotonic() - cheer.timestamp <= self.correlation_window:
                await self._submit_and_confirm(username, ctx.author.name, topic_text, cheer.bits)
                return

        # Store topic and wait for cheer
        self.pending_topics[username] = PendingTopic(
            message=topic_text,
            timestamp=time.monotonic(),
        )
        await self._send_chat(
            f"@{ctx.author.name} Topic saved! Now Cheer {self.min_bits}+ bits "
            f"within 60 seconds to submit it."
        )

    @commands.command(name="queue")
    async def cmd_queue(self, ctx: commands.Context):
        """!queue — Show current topic queue."""
        try:
            pending = self.supabase_select_queue()
            if not pending:
                await self._send_chat(
                    "Queue is empty! Submit a topic via Channel Points, "
                    f"Cheer {self.min_bits}+ bits, or api.kreygo.com/viewer"
                )
            else:
                names = [r.get("viewer_name", "Anon") for r in pending[:5]]
                count = len(pending)
                preview = ", ".join(names)
                if count > 5:
                    preview += f" +{count - 5} more"
                await self._send_chat(f"Queue ({count} topics): {preview}")
        except Exception as e:
            print(f"[TwitchBot] Queue error: {e}")
            await self._send_chat("Couldn't fetch the queue right now.")

    @commands.command(name="help")
    async def cmd_help(self, ctx: commands.Context):
        """!help — Show how to submit topics."""
        await self._send_chat(
            f"To submit a topic with bits: type 'Cheer{self.min_bits} your topic here' in chat. "
            f"OR type '!topic your topic', then Cheer {self.min_bits}+ bits within 60s. "
            f"Also: Channel Points reward | api.kreygo.com/viewer | !queue"
        )

    @commands.command(name="reload")
    async def cmd_reload(self, ctx: commands.Context):
        """!reload — Reload bot config (streamer only)."""
        if ctx.author.name.lower() != self.channel_name.lower():
            return
        self.bot_config = load_bot_config()
        await self._send_chat("Bot config reloaded!")

    # ── PubSub (Channel Points + Bits) ───────────────────────────────────────

    async def _setup_pubsub(self):
        """Subscribe to PubSub for channel point redemptions and bits."""
        try:
            pool = pubsub.PubSubPool(self)

            users = await self.fetch_users(names=[self.channel_name])
            if not users:
                print("[TwitchBot] Could not fetch broadcaster user ID for PubSub")
                return
            broadcaster_id = users[0].id

            topics = [
                pubsub.channel_points(self.broadcaster_token)[broadcaster_id],
                pubsub.bits(self.broadcaster_token)[broadcaster_id],
            ]
            await pool.subscribe_topics(topics)
            print(f"[TwitchBot] PubSub subscribed for broadcaster {broadcaster_id}")
        except Exception as e:
            print(f"[TwitchBot] PubSub setup error: {e}")

    async def event_pubsub_channel_points(self, event: pubsub.PubSubChannelPointsMessage):
        """Handle Channel Point redemptions with text input."""
        try:
            user_name = event.user.name if event.user else "Anonymous"
            message = (event.input or "").strip()

            if not message:
                await self._send_chat(
                    f"@{user_name} Your redemption needs a message! "
                    f"Please try again with text."
                )
                return

            print(f"[TwitchBot] Channel Points from {user_name}: {message[:60]}")
            result = await self._submit_topic(user_name, message, source="channel_points", bits=0)
            if result and result.get("status") == "queued":
                await self._send_chat(
                    f"@{user_name} Topic queued via Channel Points! "
                    f'"{message[:80]}{"..." if len(message) > 80 else ""}"'
                )
            elif result and result.get("status") == "rejected":
                await self._send_chat(
                    f"@{user_name} Topic didn't pass moderation. Please try a different one."
                )
        except Exception as e:
            print(f"[TwitchBot] Channel points error: {e}")

    async def event_pubsub_bits(self, event: pubsub.PubSubBitsMessage):
        """Handle bit cheers — correlate with !topic or use cheer message."""
        try:
            bits = event.bits_used
            user = event.user
            user_name = user.name if user else None

            if not user_name or event.anonymous or bits < self.min_bits:
                return

            username_lower = user_name.lower()
            cheer_message = _strip_cheer_emotes(event.message or "")

            # Flow A: cheer message contains the topic
            if cheer_message and len(cheer_message) > 5:
                print(f"[TwitchBot] Bits+message from {user_name}: {cheer_message[:60]}")
                await self._submit_and_confirm(username_lower, user_name, cheer_message, bits)
                return

            # Flow B: !topic came first, cheer confirms it
            if username_lower in self.pending_topics:
                pending = self.pending_topics.pop(username_lower)
                if time.monotonic() - pending.timestamp <= self.correlation_window:
                    print(f"[TwitchBot] Matched cheer from {user_name} with pending !topic")
                    await self._submit_and_confirm(username_lower, user_name, pending.message, bits)
                    return

            # No match — hold cheer, wait for !topic
            self.pending_cheers[username_lower] = PendingCheer(
                bits=bits,
                timestamp=time.monotonic(),
            )
            await self._send_chat(
                f"@{user_name} Thanks for the {bits} bits! "
                f"Type !topic <your message> within 60 seconds to submit it."
            )
        except Exception as e:
            print(f"[TwitchBot] Bits error: {e}")

    # ── Topic Submission ──────────────────────────────────────────────────────

    async def _submit_and_confirm(
        self, username_lower: str, display_name: str, message: str, bits: int
    ):
        """Submit a bits-paid topic and confirm in chat."""
        self.pending_topics.pop(username_lower, None)
        self.pending_cheers.pop(username_lower, None)

        result = await self._submit_topic(display_name, message, source="bits", bits=bits)
        if result and result.get("status") == "queued":
            priority = result.get("priority_score", 0)
            extra = f" (priority +{int(priority)})" if priority > 0 else ""
            await self._send_chat(
                f"@{display_name} Topic queued with {bits} bits{extra}! "
                f'"{message[:80]}{"..." if len(message) > 80 else ""}"'
            )
        elif result and result.get("status") == "rejected":
            await self._send_chat(
                f"@{display_name} Topic didn't pass moderation. Please try a different one."
            )

    async def _submit_topic(
        self, viewer_name: str, message: str, source: str, bits: int = 0
    ) -> Optional[dict]:
        """POST to /twitch-topic endpoint."""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    self.submit_topic_url,
                    json={
                        "viewer_name": viewer_name,
                        "message": message,
                        "source": source,
                        "bits": bits,
                    },
                )
                r.raise_for_status()
                return r.json()
        except Exception as e:
            print(f"[TwitchBot] Submit error: {e}")
            return None

    # ── Correlation Cleanup ───────────────────────────────────────────────────

    async def _correlation_cleanup_loop(self):
        """Expire stale pending topics/cheers every 30 seconds."""
        while True:
            await asyncio.sleep(30)
            try:
                now = time.monotonic()
                for username in [k for k, v in self.pending_topics.items()
                                 if now - v.timestamp > self.correlation_window]:
                    self.pending_topics.pop(username, None)
                for username in [k for k, v in self.pending_cheers.items()
                                 if now - v.timestamp > self.correlation_window]:
                    self.pending_cheers.pop(username, None)
            except Exception as e:
                print(f"[TwitchBot] Cleanup error: {e}")

    # ── Onboarding Loop ───────────────────────────────────────────────────────

    async def _onboarding_loop(self):
        """Post an onboarding summary every 10 minutes."""
        await asyncio.sleep(30)
        while True:
            try:
                summary = await self._generate_onboarding_summary()
                if summary:
                    await self._send_chat(summary)
            except Exception as e:
                print(f"[TwitchBot] Onboarding error: {e}")
            await asyncio.sleep(600)

    async def _generate_onboarding_summary(self) -> Optional[str]:
        state = self._get_stream_state()
        config = self.bot_config
        prompt = (
            f"You are {config.get('name', 'BoardBot')}, a Twitch chat bot.\n"
            f"Personality: {config.get('personality', '')}\n"
            f"Tone: {config.get('onboarding_style', 'friendly and informative')}\n\n"
            f"Current stream state:\n{state}\n\n"
            f"Write a brief message for NEW viewers covering:\n"
            f"1. What this stream is (AI board members debating topics in real-time)\n"
            f"2. What's happening right now\n"
            f"3. EXACT instructions for submitting a topic with bits: type your topic message in chat "
            f"and include a Cheer of {self.min_bits}+ bits in the same message (e.g. 'Cheer{self.min_bits} Should Tesla go private?'). "
            f"OR type !topic followed by their message, then Cheer {self.min_bits}+ bits separately within 60 seconds. "
            f"Also mention: Channel Points reward or api.kreygo.com/viewer as alternatives.\n\n"
            f"Rules: {json.dumps(config.get('rules', []))}\n"
            f"Off-limits: {json.dumps(config.get('off_limits', []))}\n\n"
            f"Keep it under 490 characters. Sound natural. No hashtags. Be specific about the Cheer syntax."
        )
        try:
            result = await self.call_gemini(prompt, max_tokens=200, temperature=0.9)
            return result.strip()[:490]
        except Exception as e:
            print(f"[TwitchBot] Gemini onboarding error: {e}")
            return None

    # ── Engagement Loop ───────────────────────────────────────────────────────

    async def _engagement_loop(self):
        """Randomly engage with chat every 30s–10m."""
        await asyncio.sleep(60)
        while True:
            delay = random.uniform(30, 600)
            await asyncio.sleep(delay)
            try:
                if len(self.chat_buffer) < 3:
                    continue
                response = await self._generate_engagement_response()
                if response and response.strip().upper() != "SKIP":
                    await self._send_chat(response)
            except Exception as e:
                print(f"[TwitchBot] Engagement error: {e}")

    async def _generate_engagement_response(self) -> Optional[str]:
        config = self.bot_config
        recent = list(self.chat_buffer)[-20:]
        chat_context = "\n".join(f"[{m['user']}]: {m['text']}" for m in recent)
        state = self._get_stream_state()
        prompt = (
            f"You are {config.get('name', 'BoardBot')}, a Twitch chat bot.\n"
            f"Personality: {config.get('personality', '')}\n"
            f"Tone: {config.get('tone', 'casual, witty, concise')}\n\n"
            f"Current stream state:\n{state}\n\n"
            f"Recent chat:\n{chat_context}\n\n"
            f"Generate ONE short natural chat message: react to chat, comment on the debate, "
            f"ask a question, or use a catchphrase: {json.dumps(config.get('catchphrases', []))}\n"
            f"Rules: {json.dumps(config.get('rules', []))}\n"
            f"Off-limits: {json.dumps(config.get('off_limits', []))}\n\n"
            f"If nothing natural to say, respond with just: SKIP\n"
            f"Under 200 characters. No quotes around the message."
        )
        try:
            result = await self.call_gemini(prompt, max_tokens=100, temperature=0.95)
            return result.strip()[:490]
        except Exception as e:
            print(f"[TwitchBot] Gemini engagement error: {e}")
            return None

    # ── Status Narrator ───────────────────────────────────────────────────────

    async def _status_narrator_loop(self):
        """Consume stream events and narrate key moments in chat."""
        while True:
            try:
                cmd, payload = await self.event_queue.get()
                msg = self._narrate_event(cmd, payload)
                if msg:
                    await self._send_chat(msg)
            except Exception as e:
                print(f"[TwitchBot] Narrator error: {e}")
                await asyncio.sleep(1)

    async def _on_stream_event(self, cmd: str, payload: dict = None):
        """Callback registered with StreamManager.event_listeners."""
        try:
            self.event_queue.put_nowait((cmd, payload or {}))
        except asyncio.QueueFull:
            pass

        # Keep current topic context in sync
        if cmd == "SET_INITIAL_MESSAGE" and payload:
            self._current_topic = payload.get("request_text", "")
            self._current_viewer = payload.get("viewer_name", "")

    def _narrate_event(self, cmd: str, payload: dict) -> Optional[str]:
        """Map a stream command to a chat narration string, or None to skip."""
        now = time.monotonic()
        if now - self._last_narration.get(cmd, 0) < self._narration_cooldown:
            return None

        config = self.bot_config
        catchphrases = config.get("catchphrases", [])
        msg = None

        if cmd == "RESET_SESSION":
            msg = "New session incoming... buckle up!"

        elif cmd == "SET_INITIAL_MESSAGE":
            viewer = payload.get("viewer_name", "a viewer")
            topic = payload.get("request_text", "")
            msg = (
                f'New topic from {viewer}: "{topic[:120]}"'
                if topic else f"New topic from {viewer}!"
            )

        elif cmd == "START_AUTOMODE":
            msg = "The board is now in session! Let the debate begin."
            if catchphrases:
                msg += f" {random.choice(catchphrases)}"

        elif cmd == "TRIGGER_VOTE":
            motion = payload.get("motion", "")
            msg = f"VOTE TIME! The board is voting{': ' + motion[:100] if motion else ''}."

        elif cmd == "STOP_AUTOMODE":
            msg = "Discussion concluded."

        elif cmd == "SESSION_TIMER":
            remaining = payload.get("remaining_seconds", 0)
            if 295 <= remaining <= 305:
                msg = "5 minutes remaining in this session."
            elif 55 <= remaining <= 65:
                msg = "Final minute! Wrapping up..."
            else:
                return None

        elif cmd == "BREAK_COUNTDOWN":
            remaining = payload.get("remaining_seconds", 0)
            total = payload.get("total_seconds", 0)
            if total > 0 and remaining >= total - 10:
                mins = remaining // 60
                msg = f"Taking a break. Next session in ~{mins} minutes."
            else:
                return None

        elif cmd == "NEWS_SCAN":
            msg = "Scanning today's headlines for a filler topic..."

        else:
            return None

        if msg:
            self._last_narration[cmd] = now
        return msg

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_stream_state(self) -> str:
        """Build a text description of current stream state."""
        m = self.manager
        lines = []

        if m.current_request_id:
            lines.append("Session: ACTIVE")
            if self._current_topic:
                lines.append(f"Topic: {self._current_topic[:200]}")
            if self._current_viewer:
                lines.append(f"Requested by: {self._current_viewer}")
            if m.session_end_at:
                loop = asyncio.get_event_loop()
                remaining = max(0, m.session_end_at - loop.time())
                lines.append(f"Time remaining: {int(remaining // 60)}m {int(remaining % 60)}s")
        elif m.break_end_at:
            loop = asyncio.get_event_loop()
            remaining = max(0, m.break_end_at - loop.time())
            lines.append(f"Status: ON BREAK ({int(remaining // 60)}m until next session)")
        else:
            lines.append("Status: IDLE (waiting for topics)")

        if m.automation_paused:
            lines.append("Automation: PAUSED")

        try:
            queue = self.supabase_select_queue()
            lines.append(f"Queue: {len(queue)} topics waiting")
        except Exception:
            lines.append("Queue: unknown")

        return "\n".join(lines)

    async def _send_chat(self, text: str):
        """Rate-limited chat send to the configured channel."""
        if not self.rate_limiter.can_send():
            return
        channel = self.get_channel(self.channel_name)
        if channel:
            try:
                await channel.send(text[:500])
                self.rate_limiter.record_send()
            except Exception as e:
                print(f"[TwitchBot] Send error: {e}")


# ── Utility ───────────────────────────────────────────────────────────────────

_CHEER_PATTERN = re.compile(
    r'\b(?:Cheer|BibleThump|cheerwhal|Corgo|uni|ShowLove|Party|SeemsGood|Pride|'
    r'Kappa|FrankerZ|HeyGuys|DansGame|EleGiggle|TriHard|Kreygasm|4Head|SwiftRage|'
    r'NotLikeThis|FailFish|VoHiYo|PJSalt|MrDestructoid|bday|RIPCheer|Shamrock)\d+',
    re.IGNORECASE
)

def _strip_cheer_emotes(text: str) -> str:
    """Remove cheer emotes like Cheer100, BibleThump500 from a message."""
    return _CHEER_PATTERN.sub("", text).strip()


# ── Factory ───────────────────────────────────────────────────────────────────

def create_twitch_bot(
    manager,
    gemini_fn: Callable,
    supabase_select_queue_fn: Callable,
    config: dict,
) -> BoardroomTwitchBot:
    port = config.get("server_port", 8901)
    return BoardroomTwitchBot(
        manager=manager,
        gemini_fn=gemini_fn,
        supabase_select_queue_fn=supabase_select_queue_fn,
        submit_topic_url=f"http://localhost:{port}/twitch-topic",
        config=config,
    )
