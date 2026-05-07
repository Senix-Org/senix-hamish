# Deploying the Senix worker to Hetzner Cloud

The worker polls Redis for `analyze-pr` jobs, calls the LLM, posts the GitHub PR comment, and writes results back to Supabase. It runs as a single long-lived process. Hetzner Cloud's smallest VM is plenty.

## 1. Create a server

1. Sign up at https://www.hetzner.com/cloud (no credit card needed for the trial).
2. **Add server** → **Location**: any (Helsinki / Falkenstein both work). **Image**: Ubuntu 24.04. **Type**: **CX22** (€4.50/mo, 2 vCPU, 4 GB RAM — more than enough).
3. Add an SSH key (paste the contents of your local `~/.ssh/id_ed25519.pub`).
4. Create the server. Note the public IPv4.

## 2. Install Docker

SSH in (replace `<IP>`):

```sh
ssh root@<IP>
```

Then on the server:

```sh
apt-get update && apt-get install -y docker.io git
systemctl enable --now docker
```

## 3. Get the code and the env file

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

## 4. Build and run

```sh
docker build -t senix-worker .
docker run -d \
  --name senix-worker \
  --restart=unless-stopped \
  --env-file .env \
  senix-worker
```

`--restart=unless-stopped` makes the container auto-restart on crash and on host reboot.

## 5. Verify

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

## 6. Updating

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
