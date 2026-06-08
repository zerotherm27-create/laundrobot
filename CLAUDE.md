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

## Frontend architecture notes
- **All global CSS lives in `frontend/index.html`** — no separate `.css` file. Responsive breakpoints: tablet `(min-width:768px) and (max-width:1023px)`, mobile `(max-width:767px)`.
- **Kanban layout:** `kanban-wrapper` + `kanban-board` (CSS grid). On tablet and mobile, all 5 status columns stay in a single horizontal-scrolling row (`repeat(5, minmax(190px,1fr))` + `min-width:max-content`). Do NOT change this to fewer columns — wrapping to 2 rows breaks the pipeline view and makes empty-column icons appear lower than populated ones.
- **Kanban `modalOrder` is derived, not state.** It is computed via `allGroups.find(g => (g.booking_ref || g.id) === modalOrderKey)` — there is no `setModalOrder`. To update the modal's data, update `orders` state (e.g. `setOrders(prev => prev.map(...))`) and the derived value re-computes automatically. Do NOT add a `setModalOrder` call — it will throw a ReferenceError.
- **Service/category PUT routes are full-replace.** `PUT /services/:id` and `PUT /categories/:id` overwrite every column. Never send a partial payload (e.g. `{ sort_order }` only) — it will wipe `name`, `price`, etc. Always spread the full object: `updateService(id, { ...svc, sort_order: newVal })`.
- **Multi-branch:** each branch is a `tenants` row; `primary_tenant_id` links sub-branches to parent (NULL = primary). Branch switching re-issues a JWT scoped to the target tenant. Plan limits: starter=1, growth=3, pro=unlimited. Routes `GET /tenants/my-branches`, `POST /tenants/branch`, `POST /tenants/sync-branch` must be registered BEFORE `GET /tenants/:id` in `backend/routes/tenants.js` (Express matches the first route that fits).
- **SW cache:** `frontend/src/sw.js` uses `self.skipWaiting()` + `clients.claim()` + `cleanupOutdatedCaches()` so new deploys activate immediately. ⚠️ Do NOT make the `activate` handler wipe *all* caches (`caches.keys()`→`delete`) — that nukes the freshly-populated Workbox precache too, so the app refetches every asset from the network on each navigation and feels slow. `cleanupOutdatedCaches()` removes only stale precaches. `vercel.json` sets `Cache-Control: no-store` on `/sw.js` and `no-cache` on `/index.html`; `main.jsx` calls `reg.update()` on load + `visibilitychange` so tablets pick up deploys without a manual hard-reload.
- **Walk-in POS data cache:** `WalkIn.jsx` holds a module-level `_cache` object (`categories`, `services`, `shopInfo`). First page visit fetches from API and shows a skeleton; subsequent tab navigations within the same session seed state from the cache instantly (no skeleton) while still refreshing in background. Cache resets on full page reload — intentional.

## Addon / custom-field price model
- **`orders.price` = service subtotal only** (variants + add-ons combined, no delivery). Grand total = `price + delivery_fee − promo_discount`. This invariant is documented in `frontend/src/utils/orderPrice.js` — update only that file if it ever changes.
- **Addon fields store quantity in `custom_selections[].value` and unit price in `custom_selections[].unit_price`.** The Kanban detail panel must display `unit_price × parseInt(value)` (line total), NOT just `unit_price` — the latter looks like a wrong total to staff.
- **`sync_qty` effect floors the synced value** (`Math.floor`) — addon items are always whole units. Do not sync raw floats (e.g. from a weight field) or the frontend total and backend stored price may diverge.
- **Backend `calcItemPrice` in `backend/routes/public.js`** uses `Number(cf.value)` (not `parseInt`) for addon qty, plus `Math.max(0, ...)` to reject negative quantities. Keep this consistent — `parseInt` truncates decimals and could cause frontend/backend total mismatch.
- **Walk-in orders send `price: item.itemTotal`** (precomputed on frontend). **Public booking orders send no price** — the backend recomputes from `custom_fields` via `calcItemPrice`. Never trust a client-supplied price for public orders.

## Thermal printing (walk-in + Kanban receipts)
- **Tenant printer = Xprinter XP-58 (58mm) over *classic Bluetooth SPP*, printing from Chrome on an Android tablet.**
- **`window.print()` cannot reach it** — BT thermal printers don't register as an OS print service, so the print dialog never lists the XP-58 and asks for A4. **Web Bluetooth can't reach it either** — Web Bluetooth is BLE/GATT-only; the XP-58 is classic SPP. A browser has no API to open a classic-BT socket regardless of knowing the model. **A bridge app is mandatory.**
- **Solution = RawBT** (`ru.a402d.rawbtprinter`). `printReceiptRawBT()` in `frontend/src/components/ThermalReceipt.jsx` builds the Job Order + Claim Receipt as raw **ESC/POS bytes**, base64-encodes them, and dispatches via the intent scheme:
  `intent:base64,<B64>#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;` (set as `window.location.href` from a click handler). If RawBT isn't installed the intent opens its Play Store page.
- **"Print to Thermal Printer"** (primary, teal) is on the Walk-in success screen and the Kanban reprint modal; the old Blob-URL `window.print()` is kept as a **"Browser"/"Print via Browser"** fallback for desktop/PDF.
- **Tenant-side setup (one-time, no app settings):** install RawBT → pair XP-58 in Android Bluetooth (PIN usually `0000`/`1234`) → **in RawBT, Settings → Connection type: switch from "Emulator" to "Bluetooth" and select the XP-58.** RawBT ships pointed at its built-in **Emulator** virtual printer; if left there it shows **"emulator only"** and nothing prints on the real device — this is the #1 gotcha, not a bug in our code. (Free vs paid RawBT both print to real hardware; paid only removes a small notice line.)
- ESC/POS specifics: `LINE_WIDTH = 32` (Font A @ 58mm); ₱ glyph isn't in the printer codepage so amounts use a `P` prefix via `money()`; XP-58 has no auto-cutter so the `GS V B 0` cut is a no-op and receipts feed lines for manual tear. Verified ESC/POS output starts with `ESC @` and base64 round-trips.

## Safety / process
- Never enter the FB password during re-auth — that's the tenant's step. Drive up to the consent screen only.
- `git push` to main = live frontend deploy. Only push when asked.
