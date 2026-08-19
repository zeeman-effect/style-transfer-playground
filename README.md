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
| `BETTER_AUTH_URL` | App origin (`http://127.0.0.1:3000` locally) |
| `ENCRYPTION_KEY` | 32-byte key (64 hex characters) used to encrypt stored provider API keys |
| `DATABASE_URL` | SQLite path, default `file:./data/app.db` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client for sign-in |

Generation API keys (Google, OpenAI) are entered in Settings after sign-in. They are stored encrypted in the database, not in `.env`.

Local files that must stay private:

- `.env`
- `data/` (SQLite plus generation logs)
- `examples/` (downloaded style-reference images)
