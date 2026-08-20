# Style Transfer Playground

Generate images from a prompt using the visual style of example photos. Google and OpenAI vision/image models are supported. Sign-in is Google OAuth; each user stores their own provider API keys.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`, then create the local database and start the app:

```bash
npm run db:push
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Environment

Copy `.env.example`. Do not commit `.env`.

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Auth signing secret |
| `BETTER_AUTH_URL` | App origin (`http://127.0.0.1:3000` locally; the public HTTPS origin in production) |
| `ENCRYPTION_KEY` | 32-byte key (64 hex characters) used to encrypt stored provider API keys |
| `DATABASE_URL` | Local SQLite (`file:./data/app.db`) or a Turso URL (`libsql://…`) |
| `TURSO_AUTH_TOKEN` | Turso auth token. Required when `DATABASE_URL` is not a `file:` path; unused locally |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client for sign-in |

Generation API keys (Google, OpenAI) are entered in Settings after sign-in. They are stored encrypted in the database, not in `.env`.

Local files that must stay private:

- `.env`
- `data/` (SQLite plus generation logs)
- `examples/` (downloaded style-reference images)

## Generation run history

Each generate request is stored as a row in `generation_run`. Inspect with Drizzle Studio (`npm run db:studio`) or SQL:

```sql
SELECT * FROM generation_run ORDER BY started_at DESC;
```

Image files and JSONL logs under `data/logs/` are written only when `DATABASE_URL` is a local `file:` database.

## Hosted database (Vercel)

Step-by-step production deploy (Turso, Vercel env, Google OAuth): [DEPLOY.md](./DEPLOY.md).

Local `file:` SQLite does not persist on Vercel. Use Turso:

1. Create a database and copy the `libsql://` URL and an auth token.
2. Set `DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env` (or Vercel project env).
3. Apply the schema once from a trusted machine:

```bash
npm run db:push
```

Google OAuth also needs the production origin on the OAuth client (`BETTER_AUTH_URL` and Authorized redirect URI `https://<host>/api/auth/callback/google`).
