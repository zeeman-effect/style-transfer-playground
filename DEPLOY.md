# Production deploy

Vercel + Turso (libSQL) + Google OAuth. Do this from a machine you trust. Do not commit `.env`, `data/`, or `examples/`.

This app reads `DATABASE_URL` (not `TURSO_DATABASE_URL`) and `TURSO_AUTH_TOKEN`. Schema is applied with `npm run db:push` from your laptop. Do not run `db:push` as part of the Vercel build.

## Prerequisites

- Current code is on GitHub: `zeeman-effect/style-transfer-playground` (`origin`).
- A Vercel account that can import that GitHub repo.
- A Google OAuth **Web application** client (the same one you use locally is fine). You will add the Vercel origin and callback URI to it later.
- Node.js and npm on your laptop (`npm run db:push` runs here, not on Vercel).

Generate two independent secrets (64 hex characters each). Do not reuse your local `ENCRYPTION_KEY` unless you intend to decrypt rows copied from local SQLite. Production Turso starts empty, so a new key is correct:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice: once for `BETTER_AUTH_SECRET`, once for `ENCRYPTION_KEY`.

## 1. Create a Turso database

This codebase uses `@libsql/client` and Drizzle. Create a **libSQL** database (Turso CLI default). Do **not** pass `--tursodb`; that is a different engine and is not what this app connects with.

### Option A — Turso CLI (matches this app’s env names)

Install the [Turso CLI](https://docs.turso.tech/cli/installation):

- macOS: `brew install tursodatabase/tap/turso`
- Linux: `curl -sSfL https://get.tur.so/install.sh | bash`
- Windows: Turso documents the CLI via WSL, then the same install script as Linux

Sign up or log in ([docs](https://docs.turso.tech/cli/auth/login)):

```bash
turso auth signup
# or: turso auth login
```

On WSL, add `--headless` if the browser handshake fails.

Create the database, then copy the URL and a token:

```bash
turso db create style-transfer-playground
turso db show style-transfer-playground --url
turso db tokens create style-transfer-playground
```

`--url` prints the HTTP API URL (typically `libsql://…`). That value is `DATABASE_URL`. The token is `TURSO_AUTH_TOKEN`. Use a full-access token (do not pass `--read-only`).

### Option B — Vercel Marketplace (Turso Cloud)

[Turso Cloud](https://vercel.com/marketplace/tursocloud) on the Vercel Marketplace can provision Serverless SQLite after a Vercel project exists (step 3). From a linked project:

```bash
vercel install tursocloud
```

The Marketplace listing also shows `vc i tursocloud` (same CLI). Or open the [Marketplace storage category](https://vercel.com/marketplace?category=storage), select Turso Cloud, **Install**, provision a database, and connect it to the project.

That integration injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. This app does not read `TURSO_DATABASE_URL`. Copy that URL value into a project env var named `DATABASE_URL` (keep `TURSO_AUTH_TOKEN` as injected). Then use those two values for schema push (step 2).

## 2. Push the schema (once, from your laptop)

There is no migrations folder. `npm run db:push` runs `drizzle-kit push` against whatever `DATABASE_URL` is in the environment.

Override your local `file:` URL for this command so you do not push to `data/app.db`:

```bash
cd /path/to/style-transfer-playground
npm install
DATABASE_URL='libsql://…' TURSO_AUTH_TOKEN='…' npm run db:push
```

Confirm table creation if the CLI asks. Re-run later only when `src/lib/db/schema.ts` changes. Do not add this to the Vercel build command.

## 3. Create the Vercel project

1. Open [New Project](https://vercel.com/new) and import `zeeman-effect/style-transfer-playground` from GitHub.
2. Leave **Framework Preset** as Next.js and the root directory as the repo root.
3. **Build Output Settings**: install `npm install`, build `npm run build` (equivalent to Vercel’s Next.js default `next build`).
4. You can add env vars on this screen or in **Environment Variables** after the project exists (step 4). `BETTER_AUTH_URL` needs the public HTTPS origin; if you do not know it yet, deploy first, then set it and redeploy.
5. Click **Deploy**.

## 4. Set production environment variables

In the project: **Environment Variables**. Add these for **Production**. Leave no trailing slash on URLs.

| Name | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | 64-hex secret from prerequisites |
| `BETTER_AUTH_URL` | Public origin, e.g. `https://<project>.vercel.app` (or your custom domain). No trailing slash. |
| `ENCRYPTION_KEY` | New 64-hex key for this empty database |
| `DATABASE_URL` | Turso URL from step 1 (`libsql://…`). Not `file:…`. |
| `TURSO_AUTH_TOKEN` | Token from step 1 |
| `GOOGLE_CLIENT_ID` | Same web client as local |
| `GOOGLE_CLIENT_SECRET` | Same web client as local |
| `SITE_PASSWORD` | Shared password for the site gate. Visitors must enter it before Google sign-in. Share this over Discord; do not commit it. |

Do not put Google Gemini or OpenAI keys here. Testers enter those in Settings after sign-in; they are stored encrypted in the database.

After you change env vars, [redeploy](https://vercel.com/docs/deployments/managing-deployments#redeploy-a-project). Existing deployments keep the old values.

If the first deploy used a guessed `BETTER_AUTH_URL`, copy the production URL from the deployment, set `BETTER_AUTH_URL` to that origin (https, no trailing slash), and redeploy.

## 5. Google OAuth for the Vercel host

On the Google [Clients](https://console.cloud.google.com/auth/clients) page, open the existing **Web application** client (or **Create Client** → Web application).

Add (exact host, no trailing slash on the origin):

- **Authorized JavaScript origins:** `https://<your-vercel-host>`
- **Authorized redirect URIs:** `https://<your-vercel-host>/api/auth/callback/google`

Keep the local entries as well (`http://127.0.0.1:3000` and `http://127.0.0.1:3000/api/auth/callback/google`). One client can list both environments.

If you later attach a custom domain, add that origin and `https://<custom-domain>/api/auth/callback/google` too, and set `BETTER_AUTH_URL` to the origin users actually open.

## 6. Smoke test

1. Open the production URL. Enter `SITE_PASSWORD`, then sign in with Google.
2. Settings: save a Google and/or OpenAI provider key.
3. Create or open a project, upload example images, generate.

If sign-in fails with `redirect_uri_mismatch`, the callback URI in Google does not match `https://<host>/api/auth/callback/google` for the host in the address bar (including `www` vs not, and `BETTER_AUTH_URL`).

## Notes

- **`file:` on Vercel:** Local SQLite does not persist on Vercel. `DATABASE_URL` must be the Turso `libsql://` URL, and `TURSO_AUTH_TOKEN` must be set. Image/JSONL files under `data/logs/` are only written for `file:` databases; hosted runs still store `generation_run` rows in Turso.
- **`ENCRYPTION_KEY`:** Changing it later makes stored provider keys unreadable. Treat it like a password.
- **Preview vs production OAuth:** Preview deployments use a different host than Production. Google requires an exact origin and redirect URI. Either add that preview host to the same OAuth client and set Preview `BETTER_AUTH_URL` to that origin, or only test sign-in on Production. Preview URLs also change per deployment unless you use a stable preview domain.
- **Preview database:** Sharing the production Turso database with Preview writes test users and keys into production data. Use a separate Turso database (and its own `ENCRYPTION_KEY`) for Preview if you need that isolation.
- **Function duration:** `src/app/api/generate/route.ts` already sets `maxDuration = 300`. On Hobby that is the plan maximum (5 minutes).
- **Schema later:** When `schema.ts` changes, run step 2 again from your laptop, then deploy the matching code. The Vercel build does not apply schema.
- **Site password:** This is an app-level gate (Hobby-safe). It is not Vercel Password Protection. Leave `SITE_PASSWORD` unset locally to skip it. Changing the value invalidates existing site-access cookies.
