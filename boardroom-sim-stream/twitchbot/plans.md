# Twitch Bot Requirements: Stream Interaction & Queue Management

## 1. Context & Explanation Features
* **Stream Status Updates:** The bot needs the ability to monitor and explain "what is happening" in the stream in real-time.
* **Onboarding Loop:** * **Frequency:** Every 10 minutes.
    * **Action:** Post a brief summary explaining how the app works and the current stream context to help new viewers get oriented.

## 2. Interactive Queue System (Bit/Command Trigger)
* **Logic:** Users can influence the stream by combining a specific command (e.g., `!topic`) with a bit donation.
* **Flow:**
    1. User sends a command + message + bits.
    2. Bot validates the donation and command.
    3. Bot sends a **Webhook** to the backend server with the user's message.
    4. The server adds that message to the queue for the next simulation topic.

## 3. Dynamic Chat Engagement
* **Random Interaction Logic:**
    * **Timing:** Random intervals between 30 seconds and 10 minutes.
    * **Action:** The bot interacts with people in chat or responds to specific messages to maintain a "human-like" presence.

```
message from boardroom streamer app dev:
The backend is already Python/FastAPI with asyncio and Supabase. Write the bot in the same process or as a separate Python service using twitchio — it fits naturally and lets you reuse the existing Gemini and Supabase setup.

The hardest part: bits + command correlation

The spec says "user sends command + message + bits" — but on Twitch, !topic some text (IRC message) and a cheer are two separate events with no built-in linkage. You need to decide upfront how you're handling this:

Option A (recommended): Use a Channel Point Custom Reward with text input enabled instead of bits. The message comes bundled with the redemption in a single channel.channel_points_custom_reward_redemption.add EventSub event. No correlation needed, and viewers see a dedicated button. Downside: requires affiliate/partner status and doesn't use bits.
Option B: If bits are required, hold !topic commands in a short time window (e.g., 30s) and wait for a matching cheer from the same user. This is stateful and has edge cases — what if bits come first? What if they cheer without the command? Define those failure cases explicitly before coding them.
Use EventSub, not IRC, for bits. IRC USERNOTICE tags with bits exist but are unreliable for validation. EventSub channel.cheer is the proper path and is what Twitch wants you to use.

The "random human-like engagement" feature

This is just asyncio.sleep(random.uniform(30, 600)) in a loop, calling Gemini with recent chat context, then posting the result to chat. Simple, but:

You already have Gemini wired up in main.py — share that key.
Keep a rolling buffer of the last N chat messages to give the LLM context.
Add a cooldown guard so it doesn't fire twice if the sleep drift stacks.
Twitch rate-limits chat to 20 messages/30 seconds (100 if the bot has mod). Don't let the bot pile up.
The onboarding loop

Same pattern: asyncio.sleep(600) in a task. The tricky part is generating a useful summary of "what's happening now." The backend already broadcasts session state over WebSocket — the bot should subscribe to that same signal rather than maintaining its own state. That way the summary is always accurate.

Inserting into the queue

Looking at main.py, the topic_requests table in Supabase takes a topic_message, viewer_name, and priority_score. The bot can either:

POST directly to the FastAPI server at a new /twitch-topic endpoint (keeps auth/validation in one place — preferred), or
Write directly to Supabase (faster but bypasses the moderation step in run_setup_agent)
Given the moderation prompt at line 197 of main.py, go through the FastAPI endpoint so moderation still runs.

TL;DR for the dev:

Use twitchio in Python, run as a separate service or alongside FastAPI.
Ditch bits-correlation complexity — pitch Channel Points with text input instead.
EventSub for all redemption events, twitchio's built-in IRC for chat.
Add a /twitch-topic endpoint to main.py; the bot just POSTs there.
Random engagement and onboarding are both simple asyncio sleep loops sharing the existing Gemini client.