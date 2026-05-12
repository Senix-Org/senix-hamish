# Deploying Senix

Senix runs primarily as **Vercel serverless functions**. The standalone Node worker in `worker/` is now an **optional fallback** — production does not need a 24/7 process.

## How the pipeline runs today

1. GitHub webhook hits `POST /api/webhooks/github` on Vercel.
2. The webhook handler upserts the PR + analysis rows in Supabase.
3. It fires a non-awaited `POST` to `/api/internal/analyze-pr`, protected by the `x-senix-internal-secret` header.
4. The webhook returns `200` to GitHub within milliseconds.
5. The `/api/internal/analyze-pr` function fetches the diff, builds the structural diff, calls the LLM, posts the PR comment, and updates Supabase. `maxDuration` is set to 60s.

If the synchronous dispatch fails (missing `NEXT_PUBLIC_SITE_URL` / `INTERNAL_WORKER_SECRET`, or `fetch` throws), the handler falls back to enqueuing on Upstash Redis. The standalone worker (if running) picks the job up on its next poll.

## Required env vars on Vercel

In addition to the existing Supabase / GitHub App / LLM keys:

- `NEXT_PUBLIC_SITE_URL` — e.g. `https://senix.vercel.app`
- `INTERNAL_WORKER_SECRET` — random hex; generate with `openssl rand -hex 32`
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — still required so the Redis fallback path stays available

## The standalone worker (optional fallback)

You only need to deploy `worker/` if:

- You're worried about Vercel's `maxDuration` cap for unusually large PRs.
- You want a belt-and-suspenders setup where Redis is the source of truth.
- You're running Senix on infrastructure that doesn't support serverless fan-out.

The worker behavior is unchanged — it polls `jobs:queue`, calls `processAnalyzePr`, and acks/nacks. See "Hetzner Cloud deploy" below for the original instructions; they still work as-is.

---

## Hetzner Cloud deploy (optional, for the fallback worker)

The worker polls Redis for `analyze-pr` jobs, calls the LLM, posts the GitHub PR comment, and writes results back to Supabase. It runs as a single long-lived process. Hetzner Cloud's smallest VM is plenty.

### 1. Create a server

1. Sign up at https://www.hetzner.com/cloud (no credit card needed for the trial).
2. **Add server** → **Location**: any (Helsinki / Falkenstein both work). **Image**: Ubuntu 24.04. **Type**: **CX22** (€4.50/mo, 2 vCPU, 4 GB RAM — more than enough).
3. Add an SSH key (paste the contents of your local `~/.ssh/id_ed25519.pub`).
4. Create the server. Note the public IPv4.

### 2. Install Docker

SSH in (replace `<IP>`):

```sh
ssh root@<IP>
```

Then on the server:

```sh
apt-get update && apt-get install -y docker.io git
systemctl enable --now docker
```

### 3. Get the code and the env file

```sh
git clone https://github.com/Senix-Org/senix.git
cd senix
```

Copy your production `.env` onto the server. From your laptop:

```sh
scp .env root@<IP>:/root/senix/.env
```

The worker needs at minimum (validated at startup — missing keys exit with code 1):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY` (the full multi-line PEM, surrounded by quotes if you put it in `.env`)
- `GITHUB_WEBHOOK_SECRET`
- `DEEPSEEK_API_KEY`
- `LLM_PROVIDER` (e.g. `deepseek`)

Optional: set `POST_PR_COMMENTS=true` and `DASHBOARD_URL=https://senix.app` for the customer-facing comment.

### 4. Build and run

```sh
docker build -t senix-worker .
docker run -d \
  --name senix-worker \
  --restart=unless-stopped \
  --env-file .env \
  senix-worker
```

`--restart=unless-stopped` makes the container auto-restart on crash and on host reboot.

### 5. Verify

```sh
docker logs -f senix-worker
```

You should see structured JSON lines like:

```
{"timestamp":"2026-05-06T...","level":"info","message":"env validated","vars":9}
{"timestamp":"2026-05-06T...","level":"info","message":"starting","pollIntervalMs":2000,"logFormat":"json","provider":"deepseek"}
{"timestamp":"2026-05-06T...","level":"info","message":"heartbeat","processed":0,"failed":0,"inFlight":0}
```

A heartbeat fires once per minute. Processed / failed counters reset on restart.

### 6. Updating

```sh
cd ~/senix
git pull
docker build -t senix-worker .
docker stop senix-worker && docker rm senix-worker
docker run -d --name senix-worker --restart=unless-stopped --env-file .env senix-worker
```

## Troubleshooting

- **`missing required env var`** at startup: the env file isn't mounted or a key is blank. `docker run --env-file` requires `KEY=value` lines, no quotes around the value.
- **No heartbeats** after 60s: check `docker logs senix-worker` for an early crash; `validateEnv` will have logged which key was missing before exit.
- **`installation uninstalled`** in logs: a tester removed the GitHub App. The worker correctly skips the job and marks the analysis row as completed with that note.
- **Webhook dispatched but analysis never ran**: check Vercel logs for `/api/internal/analyze-pr`. If you see 401s, `INTERNAL_WORKER_SECRET` doesn't match between the webhook and the analyze route. If you see nothing at all, `NEXT_PUBLIC_SITE_URL` is probably unset — the handler will have fallen back to Redis; check the queue or boot the worker.
