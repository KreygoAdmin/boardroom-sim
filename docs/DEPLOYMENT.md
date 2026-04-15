# Deployment Guide

This app runs via **Cloudflare Tunnel** on a local Windows machine. No reverse proxy or VPS needed — the tunnel exposes both services to the internet.

## Domains

| Service | URL |
|---------|-----|
| Frontend | https://boardroom.kreygo.com |
| Backend API | https://api.kreygo.com |

---

## Prerequisites

- Node.js + npm
- Python 3.10+
- `serve` npm package: `npm install -g serve`
- `cloudflared` installed and authenticated
- Cloudflare Tunnel named `boardroom` configured to route:
  - `boardroom.kreygo.com` → `localhost:3901`
  - `sim.kreygo.com` → `localhost:5901`
  - `api.kreygo.com` → `localhost:8901`

---

## Environment Setup

### Frontend (`boardroom-sim/.env`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_key
VITE_OPENROUTER_API_KEY=your_openrouter_key
```

### Backend (`webhook-server/.env`)

```env
STRIPE_ENDPOINT_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_live_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ELEVENLABS_API_KEY=sk_...
```

---

## Deploy (Production)

Run from the `boardroom-sim/` root directory:

```bat
deploy.bat
```

This script:
1. Builds the React frontend (`npm run build`)
2. Kills any running instances of `cloudflared`, port 5901, and port 8901
3. Waits 2 seconds
4. Calls `start.bat` to relaunch everything

### What `start.bat` launches

Three separate `cmd` windows:
1. **Cloudflare Tunnel** — `cloudflared tunnel run boardroom`
2. **Frontend static server** — `serve -s dist` on port 5901
3. **Backend API** — `uvicorn main:app` on port 8901 (from `webhook-server/`)

---

## Supabase Setup

### Required Tables

**`profiles`** (extends Supabase auth.users):
```sql
create table profiles (
  id uuid references auth.users primary key,
  plan text default 'free',
  total_tokens integer default 0,
  messages_used integer default 0,
  tts_chars_used integer default 0,
  billing_cycle_anchor timestamptz
);
```

**`boardrooms`**:
```sql
create table boardrooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  name text,
  members jsonb,
  messages jsonb,
  whiteboard text,
  settings jsonb,
  updated_at timestamptz default now()
);
```

Enable Row Level Security on both tables and add policies so users can only access their own rows.

### Auth Settings

Enable **Email/Password** auth in the Supabase dashboard. Set the site URL to `https://boardroom.kreygo.com` and add it to the allowed redirect URLs.

---

## Stripe Setup

1. Create a product + price in Stripe (Pioneer plan)
2. Add a webhook endpoint pointing to `https://api.kreygo.com/webhooks/stripe`
3. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the webhook signing secret into `STRIPE_ENDPOINT_SECRET`

---

## Cloudflare Tunnel Setup

```bash
# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create boardroom

# Create config (usually at ~/.cloudflared/config.yml):
tunnel: <tunnel-id>
credentials-file: /path/to/<tunnel-id>.json
ingress:
  - hostname: boardroom.kreygo.com
    service: http://localhost:3901
  - hostname: sim.kreygo.com
    service: http://localhost:5901
  - hostname: api.kreygo.com
    service: http://localhost:8901
  - service: http_status:404

# Add DNS records
cloudflared tunnel route dns boardroom boardroom.kreygo.com
cloudflared tunnel route dns boardroom api.kreygo.com
```

---

## Local Development

```bash
# Frontend (hot reload)
cd boardroom-sim
npm install
npm run dev        # Vite dev server on localhost:5901

# Backend (hot reload)
cd webhook-server
pip install -r requirements.txt
uvicorn main:app --reload --port 8901
```

The Vite dev server is configured to bind to `192.168.92.109:5901` in production builds — change `vite.config.js` if your local IP differs.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port already in use | `deploy.bat` kills existing processes; run it again or manually kill the process |
| Tunnel not connecting | Run `cloudflared tunnel run boardroom` manually to see errors |
| Stripe webhooks failing | Verify `STRIPE_ENDPOINT_SECRET` matches the dashboard value |
| Supabase auth errors | Check site URL and redirect URL settings in Supabase dashboard |
| TTS not working | Verify `ELEVENLABS_API_KEY` and check `tts_chars_used` in profiles table |
