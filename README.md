# The Freedom Tree 🌳

A live, collective art piece for Independence Day. One question — *"What does
freedom mean to you?"* — one line per person, one leaf per device. Watch a
holographic tree grow through the day, built entirely out of everyone's
answers, and find your own leaf later by searching its ID.

## Stack
- **Frontend:** React + Vite + React Three Fiber (procedural tree, instanced
  leaves, bloom postprocessing)
- **Backend:** Express (Node)
- **DB:** Supabase (Postgres) — stores leaves, enforces one-per-device via IP
  at the DB level
- **Counters:** Upstash Redis — live theme + total leaf counts
- **Classification:** Groq (`llama-3.1-8b-instant`) — classifies each
  submission into a theme, with a keyword fallback if Groq errors/times out

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. Open the SQL editor, paste and run `schema.sql`.
3. Copy your Project URL and `service_role` key (Settings → API).

### 2. Upstash Redis
1. Create a free Redis database at upstash.com (choose the REST API region
   closest to your deploy target).
2. Copy the REST URL and REST token.

### 3. Groq
1. Get a free API key at console.groq.com.

### 4. Backend
```bash
cd server
cp .env.example .env   # fill in Supabase, Upstash, Groq keys
npm install
npm run dev             # runs on :8787
```

### 5. Frontend
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8787" > .env
npm run dev              # runs on :5173
```

Open `http://localhost:5173` — you should see the tree (empty at first),
the submit form, and the search bar.

## Deploy

- **Backend:** Render or Railway (Node service). Set the same env vars from
  `.env.example` in the dashboard. Set `CORS_ORIGIN` to your deployed
  frontend URL.
- **Frontend:** Vercel. Set `VITE_API_URL` to your deployed backend URL.

Both deploy in a few minutes on free tiers — comfortably enough for a
one-day event unless it goes seriously viral, in which case Groq/Upstash/
Supabase all have cheap paid tiers to fall back on.

## How the pieces fit together

1. User writes ≤100 words → `POST /api/submit-leaf`
2. Server hashes their IP, checks Supabase for a submission in the last 24h
   (also enforced by a DB trigger as a hard backstop) → rejects if found
3. Groq classifies the text into one of 6 themes → theme maps to a tricolor
   band (saffron / white / green)
4. Leaf position is computed with a golden-angle spiral so leaves cluster
   naturally across the canopy as the count grows
5. Leaf is inserted into Supabase, Redis counters bumped, a short unique ID
   returned to the user
6. Frontend polls `/api/leaves` every 15s so the tree fills in for everyone,
   not just the person who just submitted
7. Searching an ID hits `/api/leaf/:id`, and the camera smoothly flies to
   that leaf's stored position and pulses it

## Notes / known limits
- Rate limiting is IP + localStorage based, not fingerprinting — good enough
  for a cultural artifact, not built to survive a determined attacker.
- `localStorage` flag means clearing storage + a fresh IP (e.g. mobile data
  reset) can technically get a second leaf through — accepted tradeoff for
  keeping this frictionless (no login).
