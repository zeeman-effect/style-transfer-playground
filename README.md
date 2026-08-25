# Style Transfer Playground

Generate images from a prompt using the visual style of example photos. Google and OpenAI vision/image models are supported. Sign-in is Google OAuth; each user stores their own provider API keys.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` with auth secrets and a Google OAuth client, then create the database and start the app.

Generate `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` (64 hex characters each; run twice):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create a Google OAuth **Web application** client ([Clients](https://console.cloud.google.com/auth/clients)). Use `127.0.0.1`, not `localhost`:

- **Authorized JavaScript origins:** `http://127.0.0.1:3000`
- **Authorized redirect URIs:** `http://127.0.0.1:3000/api/auth/callback/google`

Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Then:

```bash
npm run db:push
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Tests

```bash
npm test          # watch mode
npm run test:run  # single run (CI)
```

GitHub Actions runs `npm run test:run` on pull requests and pushes to `master`.

## Using the app

First-time flow after the app is running: sign in with Google, save provider keys in Settings, add example images (upload or pull from Instagram/X), then generate.

### 1. Sign in

If `SITE_PASSWORD` is set, enter that first. Click **Sign in**, then **Continue with Google**. Projects and keys are tied to that Google account.

If sign-in fails with `redirect_uri_mismatch`, the OAuth client origin/callback must match the URL in the address bar exactly (`127.0.0.1` vs `localhost`, `http` vs `https`). Production URIs are in [DEPLOY.md](./DEPLOY.md).

### 2. API keys

Open **Settings**. Paste a key for at least one provider and click **Save**. You only need the provider you will generate with (and the analysis-model provider, if that analyzer uses one).

| Provider | Where to get a key |
| --- | --- |
| Google Gemini | [Google AI Studio](https://aistudio.google.com/apikey) |
| OpenAI | [OpenAI API keys](https://platform.openai.com/api-keys) |

Keys are stored encrypted in the database for your account. They are not read from `.env`. Remove a saved key from Settings at any time.

If the selected model's provider has no key, Generate stays disabled until you save one.

### 3. Example images

Sign-in creates a project. Add style references by uploading files or pulling from a public feed. A project can hold up to 24 images; one feed pull is at most 12.

**Upload:** drop PNG, JPG, WebP, or GIF files onto **Example images**.

**X:** choose X, paste an `@handle` or profile URL, set how many photos, click **Pull**. The app downloads stills from the public timeline. No X login is required.

**Instagram:** Instagram needs your logged-in browser session (the server cannot fetch the profile for you):

1. Choose Instagram, paste an `@handle` or profile URL, set how many images, click **Pull**.
2. A tab opens on that profile. The import script is copied to the clipboard.
3. On that Instagram tab, open the console (F12 → Console) and paste the script. Allow pasting if the console asks.
4. When it finishes, the images appear under **Example images** on the playground. Switch back to that tab if they do not show up immediately.

If the clipboard copy fails, use **Copy script** on the playground. You can also drag **Bookmarklet** to the bookmarks bar and click it while viewing an Instagram profile.

Private, login-walled, or age-restricted profiles only work if the Instagram account in that browser can already see the posts. Reels and videos are skipped.

Then write a prompt, pick a provider/model, and click **Generate image**.

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
| `SITE_PASSWORD` | Optional shared site password. When set, visitors must enter it before using the app (including Google sign-in). Leave empty locally if you do not want a gate |

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
