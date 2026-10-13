# Daily Planner Push Worker

Cloudflare Worker that stores Web Push subscriptions + reminder schedule in KV, and sends morning/evening habit notifications via Cron.

**Does not store goals or review text** — only `subscription` + schedule times/toggles.

## API

| Method | Path | Body |
|--------|------|------|
| `GET` | `/vapidPublicKey` | — → `{ publicKey }` |
| `POST` | `/subscribe` | `{ subscription, schedule }` |
| `POST` | `/unsubscribe` | `{ endpoint }` or `{ subscription }` |
| `POST` | `/schedule` | `{ endpoint, schedule }` |
| `OPTIONS` | `*` | CORS preflight |

`schedule`: `{ morning: "08:00", evening: "21:00", morningOn: true, eveningOn: true, tz: "Asia/Hong_Kong" }`

Cron `*/5 * * * *` checks HKT time; sends at most once per slot per calendar day; deletes dead endpoints (410/404).

## Deploy (Kyle)

```bash
cd worker
npm install
npx wrangler login          # browser login once
npx wrangler kv namespace create SUBS
# paste the id into wrangler.toml [[kv_namespaces]] id=
npx wrangler secret put VAPID_PRIVATE_KEY   # paste the JWK JSON string
npx wrangler secret put VAPID_SUBJECT       # e.g. mailto:you@example.com
npx wrangler deploy
```

Then set `PUSH_API` in `../index.html` to the printed `*.workers.dev` URL and push the Pages repo.

VAPID keys were generated with `npx @pushforge/builder vapid`. Public key is already in `wrangler.toml` `[vars]` and the frontend. Keep the private JWK only as a Worker secret.
