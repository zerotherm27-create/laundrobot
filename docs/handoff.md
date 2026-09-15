# Handoff — Tenant-specific booking-link previews

**Date:** 2026-09-15
**Scope:** `frontend/middleware.js`, `backend/routes/public.js`, new `docs/handoff.md` (this file).
**Branch:** `claude/clever-albattani-aznvu4` — **pushed, NOT merged to `main`, NOT live.** Per `CLAUDE.md`, a plain `git push` to `main` is what deploys the frontend; this only pushed the feature branch. No PR opened (not requested).
**Commit:** `9544001` — extend link-preview middleware to tenant booking links on the shared domain.

---

## 1. The problem

A tenant sharing their booking link got the generic LaundroBot marketing-site preview (title/description/image) in Messenger, iMessage, Slack, etc. — not their own shop name.

## 2. Root cause

`frontend/middleware.js` (Vercel Edge Middleware) already existed and already solved this — but only for **custom white-label domains** (e.g. `book.thelaundryproject.app`). It explicitly returned `next()` (no rewrite) for `laundrobot.app` / `www.laundrobot.app`:

```js
if (PLATFORM_HOSTS.has(hostname) || hostname.endsWith('.vercel.app')) {
  return next();
}
```

**Most tenants don't have a custom domain.** The link they actually share is the shared-platform path `https://laundrobot.app/book/:tenantId` (`frontend/src/pages/Overview.jsx:121`, and the referral link built in `Settings.jsx:1545`). That path was hitting the early return above and always serving the static `frontend/index.html` OG tags — the LaundroBot brand, for every tenant, every time.

## 3. Fix

`frontend/middleware.js` no longer short-circuits on platform hosts. It now branches:

- **Platform host (`laundrobot.app` etc.) + path matches `/book/:tenantId`** → looks up the tenant via the existing `GET /public/:tenantId/info` endpoint, then rewrites title/description/canonical/OG/Twitter tags to that shop.
- **Platform host, any other path** (marketing site, dashboard) → unchanged, `next()`.
- **Any other hostname** (custom/white-label domain) → same as before, looked up via `GET /public/by-domain/:hostname`.

Both branches now funnel through one `applyTenantMeta(origin, pageUrl, tenantName, logoUrl)` helper (previously the string-replace block was duplicated only once, for the custom-domain path; factored out so the same logic serves both).

`backend/routes/public.js`'s `/by-domain/:hostname` route now also selects and returns `logo_url`, so custom-domain previews can use the shop's own logo the same way the new path-based branch does — previously that endpoint returned only `id`, `name`, `white_label`.

**Failure mode stays "fail open":** any fetch error, non-200, or missing tenant name on either lookup falls through to `next()` — the untouched default page, never a broken one.

## 4. A real bug caught before shipping: `logo_url` is not a URL

`tenants.logo_url` is frequently a base64 **`data:` URI**, not an `https://` URL — `Settings.jsx`'s logo uploader runs the file through `compressImage()` (`frontend/src/utils/imageCompress.js`), which resolves with `canvas.toDataURL(...)`. Open Graph/Twitter Card crawlers require a fetchable image URL; a `data:` URI in `og:image` doesn't render.

Guarded in `applyTenantMeta`:
```js
const image = (logoUrl && /^https?:\/\//i.test(logoUrl)) ? logoUrl : DEFAULT_IMAGE;
```
So a tenant with a data-URI logo (the common case — most tenants upload via that flow) still gets a working preview, just with the default LaundroBot image instead of their own logo. Only a tenant whose `logo_url` happens to be a real hosted `https://` URL gets their own logo in the preview.

## 5. What this does NOT do

- Does not give every tenant their own logo in the preview — only those with an `https://` `logo_url`, which today means essentially none (the only upload path produces a data URI). If per-tenant logo previews matter, `logo_url` needs a real upload-to-storage path (e.g. Supabase Storage) instead of an in-browser data URI, independent of this change.
- Does not touch `/book/:tenantId?ref=CODE` referral-link query strings for canonical/`og:url` purposes — those are stripped (`${url.origin}${url.pathname}`, no query) so the canonical points at the clean booking URL, matching how the custom-domain branch already behaved.
- Does not change anything for Messenger/Instagram in-chat sharing — this is purely the OG/Twitter preview when a URL is pasted or sent as a link, which is what unfurls in Messenger, iMessage, Slack, etc.

## 6. Verification done

- Full backend suite: 100/100 passing (`cd backend && npm install && node --test`) — the pre-existing 5 "failures" seen before `npm install` were just missing `node_modules` in this sandbox, not real regressions (confirmed via `Cannot find module 'express'`), unrelated to this change.
- `node --check frontend/middleware.js` — syntax OK.
- **Not verified live** — branch isn't merged to `main`, so nothing has deployed. Whoever merges this should re-verify with the pattern already documented in `CLAUDE.md`'s deploy-gotchas section (bypass the browser/SW cache, check the actual served bundle) and additionally test an actual `/book/:tenantId` link through a real crawler (e.g. Facebook's Sharing Debugger or pasting the link into Messenger) since edge middleware behavior can't be fully verified by `curl` alone without spoofing the crawler UA — plain `curl` will exercise the same code path since the middleware doesn't check user-agent, so a plain `curl -sL https://laundrobot.app/book/<a real tenant id>` should already show the rewritten `<title>`/`og:*` tags.

## 7. What's intentionally left open

- **No PR opened** — not requested this session.
- **Real per-tenant logo previews** need a hosted-URL upload path for `logo_url`; out of scope here (see §5).
- **`CLAUDE.md` Meta/Messenger section was not touched beyond adding this feature's own entry** — the two items flagged as still-open in the previous handoff (the shop-announcement feature's docs, and the `secure-reverence` vs `fearless-love` Railway project trap) are still not in `CLAUDE.md`. Not this session's scope; still worth doing.
