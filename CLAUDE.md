# CLAUDE.md — LaundroBot

Operational guide for working on this repo. Read before deploying, touching Meta/Messenger
integration, or debugging "why isn't my change live."

## What this is
Multi-tenant SaaS for laundry shops: Messenger/Instagram booking bot + admin dashboard
(orders, kanban, finance, inventory, walk-in POS). Monorepo:
- `frontend/` — Vite + React admin app and customer booking pages
- `backend/`  — Express API, Messenger/Instagram webhooks, Xendit payments

## Hosting & deploy (READ THIS FIRST)
- **Frontend → Vercel project `laundrobot`** (`prj_EpiIpeuTFXPwiaNq30urGR7X5s2L`, team `team_I6jgfHPrez0G1ZvYMOkNQhRn`).
  - Serves `laundrobot.app`, `www.laundrobot.app`, `www.thelaundryproject.app`, `book.thelaundryproject.app`.
  - **Auto-deploys from GitHub `main`** (`zerotherm27-create/laundrobot`). A plain `git push` to main deploys the frontend.
  - ⚠️ There is a **second, STALE Vercel project named `frontend`** (`prj_1uCS3…`) — last deployed ~May 27, NOT git-connected, serves nothing live. Ignore it / safe to delete. Do not be fooled by it when checking deploy status.
  - ⚠️ `frontend/.vercel/project.json` historically pointed at the stale `frontend` project. It now points at `laundrobot`. If CLI deploys target the wrong project, fix this file or run `vercel link`.
- **Backend → Railway.** Webhook URL + env vars (`FB_VERIFY_TOKEN`, `FB_APP_ID`, `DATABASE_URL`, etc.) live in Railway. Confirm Railway actually redeploys backend commits — don't assume.
- **DB → Supabase** (Postgres). Local `backend/.env` `DATABASE_URL` points at the same prod DB, so backend scripts run locally hit prod data.

## Deploy gotchas
- **PWA service worker caches aggressively.** After a frontend deploy, the browser keeps serving the old bundle until the SW updates — a normal reload is not enough. Hard-reload (Cmd+Shift+R), sometimes twice. To verify what's ACTUALLY live, bypass the browser:
  ```
  curl -sL https://laundrobot.app/ | grep -oE '/assets/[^"]+\.js'
  curl -sL https://laundrobot.app/assets/<bundle>.js | grep -o '<string you shipped>'
  ```
- **No `Co-Authored-By` lines in commits.** Vercel blocks deploys when the commit's email isn't a project collaborator. Omit the trailer entirely.
- Verify deploy state via the Vercel MCP against the **`laundrobot`** project, not `frontend`.

## Meta / Messenger / Instagram
- **FB OAuth scope list lives in `frontend/src/pages/Settings.jsx`** (`handleFbLogin`). Page access tokens only carry permissions that were in the scope at connect time — **adding a scope requires the tenant to reconnect (re-auth)** to mint a new token. App admins/testers can grant permissions pre-App-Review.
- **Message tags `POST_PURCHASE_UPDATE` / `CONFIRMED_EVENT_UPDATE` / `ACCOUNT_UPDATE` are DEPRECATED (error 100) as of 2026-04-27.** `backend/utils/messenger.js` `sendTaggedMessage()` still uses `POST_PURCHASE_UPDATE` — it now fails, so out-of-24h order-status notifications are broken until migrated.
- **Replacement = Utility Message Templates** (`pages_utility_messaging` permission):
  - Create: `POST /{page-id}/message_templates` (Graph **v21.0**), `category: "UTILITY"`, BODY component.
  - Watch `PARAMS_TO_WORD_RATIO_EXCEED_LIMIT` — need enough static text per `{{n}}` variable. Few words + many vars → REJECTED.
  - Probe/creator script: `backend/scripts/create-utility-template.js` (reads tenant token from DB).
  - Approved template exists: **`order_status_update_v2`** (id `27038636189155408`).
  - TODO (not done): migrate `sendTaggedMessage` to SEND this approved template so COMPLETED/PROCESSING/FOR DELIVERY notifications work again.
- **App Review "X of 1 API call(s)" counter is delayed/aggregated, not real-time** (even auto-used `public_profile` reads 0). A successful call won't reflect for hours.
- Order-status notifications only fire for customers with an `fb_id` (Messenger users). Web/walk-in customers have none → no notification (see `project_whatsapp_viber_notifications.md` in memory for the planned fallback).
- Instagram DM replies blocked until `instagram_manage_messages` passes App Review. Webhook matches tenant by `ig_user_id` = the `17841…` IG business id; handler logs `[ig-webhook] …` verbosely (check Railway logs to debug activation).

## Safety / process
- Never enter the FB password during re-auth — that's the tenant's step. Drive up to the consent screen only.
- `git push` to main = live frontend deploy. Only push when asked.
