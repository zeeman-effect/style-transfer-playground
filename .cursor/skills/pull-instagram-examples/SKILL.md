---
name: pull-instagram-examples
description: >-
  Pulls images from an Instagram profile into examples/<account>/. Use when
  the user wants Instagram example images, style-reference posts, or invokes
  /pull-instagram-examples with an account, image count, and newest or oldest
  order.
argument-hint: "<account> <count> <newest|oldest>"
---

# Pull Instagram examples

Download post **images** from an Instagram account into `examples/<account>/`.
Run the bundled Node script; do not reimplement scraping in chat.

## Parse

Accept `/pull-instagram-examples <account> <count> <newest|oldest>`.

- **account**: username, `@username`, or `https://www.instagram.com/<username>/`
- **count**: positive integer — number of **images** (carousel slides count separately; videos/reels are skipped)
- **order**: `newest` or `oldest` (also accept "newest first" / "oldest first")

If account, count, or order is missing, ask once. Do not guess order.

## Execute

Work from the **workspace root**. Use Node.js 18+ (`fetch` is built in). Do **not** add npm or Python packages.

```bash
node .cursor/skills/pull-instagram-examples/scripts/pull.js ACCOUNT COUNT ORDER
```

`oldest` walks the full profile before downloading; warn that large accounts are slow and may be rate-limited.

Public profiles sometimes work anonymously. If Instagram asks for a login, rerun with `INSTAGRAM_COOKIE` (never ask for a password).

## How to get INSTAGRAM_COOKIE

1. In a browser, open Instagram while logged in (any page is fine).
2. Press F12 to open DevTools, then open the **Network** tab.
3. Filter to **Doc** / **Document** (not Fetch/XHR).
4. Reload the page.
5. Click the **first document** request. Its name is `instagram.com` only on the homepage; on a profile or other page it is named after that page instead.
6. Open **Headers → Request Headers** and copy the entire **Cookie** value.

Rerun from the workspace root:

```bash
INSTAGRAM_COOKIE='paste-the-Cookie-header-here' node .cursor/skills/pull-instagram-examples/scripts/pull.js ACCOUNT COUNT ORDER
```

`INSTAGRAM_SESSIONID` can be set instead of a full cookie header, but the full Cookie value from that document request is more reliable.

Treat that string like a password. Do not paste it into chat. Do not complete an interactive login yourself.

If the script exits because a login is required (including private or age-restricted profiles), it prints these same steps. Surface that output to the user.

## Account errors

The script distinguishes these cases — report its message, do not collapse them:

| Case | What the script says |
| --- | --- |
| Username does not exist | `Instagram account not found: <name>` (no cookie instructions) |
| Age-restricted profile | Profile is hidden until a logged-in account meets Instagram's age requirement, then the cookie steps |
| Private profile | Needs a session for an account that follows it, then the cookie steps |
| Other login / session required | `Instagram required a valid login.` plus the cookie steps |

## Output

The script writes only image files under `examples/<canonical-username>/` (no captions, JSON, or videos). Names look like `YYYYMMDD_<shortcode>_<part>.jpg`.

Report the printed summary: destination, downloaded vs already present, skipped videos, and whether it stopped early because the profile had fewer images.

Exit codes: `1` usage, `2` login/session/private/age-restricted, `3` missing account, `4` network/rate limit.

## Examples

```
/pull-instagram-examples natgeo 12 newest
/pull-instagram-examples @memes 8 oldest
```
