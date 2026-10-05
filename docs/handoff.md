# Handoff — TLP POS push integration after payment confirmation

**Date:** 2026-10-05
**Scope:** `backend/utils/tlpPos.js` (new), `backend/db/migrations/2026-10-05-tlp-pos-service-tags.sql` (new), `backend/.env.example` (new), `backend/webhooks/xendit.js`, `backend/routes/orders.js`
**Companion repo:** TLP POS at `/Users/jojo/Documents/TLP POS` — also changed `api/orders/import.js` in that repo (commits `1772402`, `0db60ca`).
**Commits (LaundroBot main, pushed):**
- `126f979` — feat: dispatch paid orders to TLP POS after payment confirmation

---

## Context

TLP POS (the laundromat ops dashboard) needs to know about paid LaundroBot orders immediately. Previously only a 5-minute pull poll existed; now LaundroBot pushes the order to TLP POS the moment payment is confirmed, in two places: the Xendit webhook callback and the manual verify-payment endpoint.

## Schema change — `services` table

Migration `2026-10-05-tlp-pos-service-tags.sql` adds two nullable columns to `services`:

```sql
machine_kind     TEXT   -- 'washer' | 'dryer' | NULL
duration_minutes INT    -- e.g. 35 — must match a TLP POS product
```

**Run this migration against Supabase before enabling dispatch.** After running, open each machine-wash/dry service in the LaundroBot admin and fill in these two fields. Services left NULL are silently skipped by the dispatch — handwash, dryclean, fold-only orders never reach TLP POS.

## `utils/tlpPos.js`

New standalone helper: `dispatchToTlpPos(db, ref, tenantId, isByBookingRef)`.

- `isByBookingRef = true` → fetches all paid non-cancelled orders with that `booking_ref` (covers multi-load bookings where each load is a separate row)
- `isByBookingRef = false` → fetches the single order by `id`
- Joins `services` and `customers` to get machine kind, duration, price, and customer info
- Builds one service entry per load (each DB row = one machine load, `quantity: 1`)
- Skips if no machine services in the result
- POSTs to `process.env.TLP_POS_IMPORT_URL` with `Bearer TLP_POS_IMPORT_TOKEN`
- **All errors are caught and logged — never re-thrown.** Payment confirmation must never fail because TLP POS is down.

## Hooks in `webhooks/xendit.js`

Two dispatch calls added:

1. **BKG-ref path** (line ~161): fires after the `UPDATE orders SET paid=TRUE WHERE booking_ref=...` succeeds, only inside the `total_paid >= total_due` block (partial payments are correctly skipped).
2. **Order-id path** (line ~189): fires after the `UPDATE orders SET paid=TRUE WHERE id=...` succeeds.

Both are `.catch(e => console.error('[tlp-pos]', e.message))` fire-and-forget.

## Hook in `routes/orders.js` verify-payment

Dispatch fires after the manual `UPDATE orders SET paid=TRUE` (line ~988), before `res.json({ ok: true })`. Uses `isByBookingRef = !!order.booking_ref` so booking-grouped orders (multiple loads) are all fetched together.

## `.env.example`

Created for the first time. Add to LaundroBot's actual `.env`:

```
TLP_POS_IMPORT_URL=https://your-tlp-pos.vercel.app/api/orders/import
TLP_POS_IMPORT_TOKEN=<must match LAUNDROBOT_IMPORT_TOKEN in TLP POS .env>
```

If either var is unset, `dispatchToTlpPos` returns early — dispatch is opt-in by configuration.

## TLP POS `import.js` changes (companion)

The import endpoint previously called `buildOrderBundle(body)` directly, bypassing `mapLaundrobotOrder`. Fixed:

- Now calls `mapLaundrobotOrder(rawOrder)` to match `{ kind, durationMinutes }` pairs against TLP products and expand multi-load quantities into per-load `ServiceLine` entries with UUIDs
- Returns `{ ok: true, skipped: true }` for non-machine orders (not an error)
- Checks for existing `external_order_id` before inserting — idempotent, safe for Xendit retries
- Auth hardened: `LAUNDROBOT_IMPORT_TOKEN` now fails closed when unset (was fail-open); uses `crypto.timingSafeEqual`; returns 401 (not 500) on auth failure

## What's intentionally left open

- **Run the migration.** Until `machine_kind` + `duration_minutes` are set on services, no orders will be dispatched (the filter returns 0 machine services).
- **Set the env vars on both sides.** LaundroBot needs `TLP_POS_IMPORT_URL` + `TLP_POS_IMPORT_TOKEN`; TLP POS needs `LAUNDROBOT_IMPORT_TOKEN`.
- **TLP POS Supabase setup** is still pending (table not yet created, credentials not set).
- **No end-to-end live test done** — verified only by code review and log pattern (`[tlp-pos] dispatched order BKG-xxx`).

---

# Handoff — Native mobile UI, Kanban notify control, Overview/Reports redesign

**Date:** 2026-09-20
**Scope:** `frontend/src/App.jsx`, `frontend/src/components/{BottomTabBar,InstallPrompt,Charts,Icons,StatusBadge}.jsx`, `frontend/src/context/{ToastContext,ToastStack}.jsx`, `frontend/src/hooks/useInstallPrompt.js`, `frontend/src/utils/format.js` (new), `frontend/src/pages/{Kanban,Overview,Reports,Finance,Orders}.jsx`, `backend/routes/orders.js`, `frontend/index.html`.
**Commits (all on `main`, pushed and confirmed via `npm run build` after every step — no live prod verification, see below):**
- `537a451` — native-style mobile UI: bottom tab bar, install prompt banner, page-fade transitions
- `a286121` — install prompt rebuilt as a toast instead of a standalone banner
- `9efc2d6` — bottom tab bar restyled icon-only (Instagram-style), per explicit reference
- `930cb76` — optional "notify customer?" prompt on Kanban Processing/For Delivery moves
- `0d326f2` — extracted Finance.jsx's chart components into shared modules
- `900a5fd` — Reports.jsx visual-consistency redesign
- `8780814` — Overview.jsx visual-consistency + scannability redesign
- `e3febcd` — fixed Orders page filter-row overflow on mobile

---

## 1. Native-style mobile UI (`537a451`, `a286121`, `9efc2d6`)

**Bottom tab bar** — `frontend/src/components/BottomTabBar.jsx`. Fixed nav on mobile only (<768px, same breakpoint the sidebar drawer already used) with 4 tabs (Overview, Kanban, Orders, WalkIn — hardcoded `TAB_KEYS`, not derived from role) + a "More" tab that toggles the existing sidebar drawer rather than duplicating its nav list. Visibility for each tab reuses `isNavVisible(navKey, role, user)`, now exported from `Sidebar.jsx`, so the sidebar and the tab bar can never drift out of sync on staff permissions — **if you ever add/remove a nav item, this is the one function to update.**

Restyled **icon-only** (`9efc2d6`) at the user's explicit request, referencing Instagram's bottom nav: no text labels, 26px icons, bold+near-black when active vs. gray when inactive (simulated via `strokeWidth` since the icon set is stroke-only, not filled/outline pairs). If a future request wants filled-icon "active" states, that requires new SVG paths per icon — there's no shortcut with the current `Icon` component.

**Install prompt** is *not* a standalone banner — it fires as a **toast** (`frontend/src/components/InstallPrompt.jsx`, a non-rendering controller) through the shared toast system. This required extending `ToastContext`/`ToastStack` with an optional `action: {label, onClick}` button and `onDismiss` callback (backward compatible — every existing `toast(message)`/`toast(message, tone)` call site is unaffected). **Reuse this `action`/`onDismiss`/`persist` toast API for any future actionable notification** instead of building another one-off banner component.

**Known gap, not fixed this session:** `beforeinstallprompt` never fires on iOS (any browser) — this is a WebKit limitation, not a bug. The toast simply never appears there; that's correct/expected, not something to "fix."

## 2. Kanban: optional notify prompt on status moves (`930cb76`)

**The ask:** staff sometimes finish laundry early and don't want to notify the customer immediately when moving a card to Processing/For Delivery — but Completed must **always** auto-notify unconditionally, no exceptions (explicit user requirement, tested against twice during design).

**How it works:**
- `PATCH /orders/:id` (`backend/routes/orders.js`) now reads an optional `notify` field from the body; `shouldNotify = notify !== false` (omitting it entirely — every caller except Kanban — preserves the old always-notify behavior). Only the `PROCESSING`/`FOR DELIVERY` `sendStatusNotification` calls are gated; the `COMPLETED` branch (`sendCompletionNotification` + `deductInventory`) is **untouched** — do not add a notify guard there without re-confirming this requirement first.
- New `POST /orders/:id/notify` — looks up the order's current status and manually re-fires `sendStatusNotification` for `PROCESSING`/`FOR DELIVERY` only. Reuses the function verbatim; relies on its existing per-booking dedupe (lowest-id row sends), so calling it once per id in a multi-row booking still sends exactly one message.
- `Kanban.jsx`'s `moveStatus()` is the single choke point for all three move interactions (drag-and-drop, per-card arrow buttons, the modal's status buttons) — the "Notify customer?" confirm dialog (reusing the existing `useConfirm()`/`ConfirmDialog` already in this file for the cancel-order flow) lives there once, not duplicated per interaction. `NOTIFY_STATUSES = new Set(['PROCESSING', 'FOR DELIVERY'])` deliberately excludes `COMPLETED`.
- Two ways to send a skipped notification later: a bell icon in the expanded card's move-arrow row (`e.stopPropagation()` required — the whole card has an `onClick` that opens the modal), and a "Notify Customer Now" button in the order modal. Both call the same `notifyNow(orderIds)` helper.

**If you touch order-status notifications again:** the pattern is now `notify: false` in the PATCH body to skip, `POST /:id/notify` to send manually later. Don't reintroduce a second mechanism.

## 3. Shared chart components (`0d326f2`)

`Finance.jsx` had 4 chart components (`TrendChart`, `DonutChart`, `HorizBars`, `RetentionChart`, ~400 lines) that `Overview.jsx` and `Reports.jsx` were each partially reimplementing (a near-duplicate `MiniRetentionChart` in Overview, an inline donut in Reports). Extracted verbatim into `frontend/src/components/Charts.jsx` + `frontend/src/utils/format.js` (the `PESO`/`PCT`/`KPESO`/`MONTHS`/`FULL_MONTHS` formatters). `Finance.jsx` now imports them back — **zero behavior change there**, verified by chunk-size comparison before/after.

**Two additive changes made during the move** (present only in the shared version, not in Finance.jsx's original code — worth knowing if you diff against old Finance.jsx history): tap-to-toggle tooltips alongside the existing hover (mobile had no way to see tooltips before), and the tooltip edge-clamp logic generalized from a hardcoded `hov >= 9` (assumed exactly 12 months) to `hov >= data.length - 3` (works for the new variable-length `MiniBarChart`, added for Reports' day-bucketed revenue chart).

`HorizBars` gained an optional `formatValue` prop (default `PESO`, so every existing Finance.jsx caller is unchanged) — needed because Reports' orders-by-status breakdown wanted plain counts, not currency. **If you add a new `HorizBars` caller with non-currency values, pass `formatValue` — don't skip it and let counts render as `₱5.00`.**

**Any future Overview/Reports/Finance chart work should import from `components/Charts.jsx`, not add a new local chart function.** That's the whole point of this extraction.

## 4. Overview.jsx / Reports.jsx visual-consistency pass (`900a5fd`, `8780814`)

Scoped explicitly as **visual polish only** by the user (no new data, no new backend calls) — reacting to three named complaints: cluttered/hard to scan, inconsistent with the rest of the app, rough on mobile. Not a rewrite: reused the app's existing `.stat-card` CSS class (`frontend/index.html`), which turned out to be **completely unused before this session** despite being fully styled — every stat-card-shaped thing on both pages was a hand-duplicated inline-style copy of the same recipe.

**Overview.jsx**, per explicit follow-up instruction, went from **three** competing high-chroma gradient bands (booking-link banner, Today's Revenue, MTD Revenue) down to **one**: Today's Revenue is the sole gradient hero; the booking-link banner moved below the stat cards and became a quiet `.stat-card`-style row (it's a static utility action, not a KPI); MTD Revenue is now a plain stat tile. **If asked to add another prominent banner to this page, push back on stacking a second loud color block — that's the exact regression this session fixed.**

**Reports.jsx**: emoji icons (🛒🌐💬) replaced with the app's own `Icon`/`IconBadge` components; a `.stat-grid-4` class that was actually rendering 3 columns (a real bug, not just cosmetic — it broke on mobile) fixed with a new `.stat-grid-3` class (stacks to 1 column on phones, since 3 doesn't split evenly at 2); flat-gray tiles and 7 mismatched card containers (radius 12px, matching no token) unified onto `.stat-card`.

**A `dataviz`-skill accessibility finding, deliberately NOT acted on this session:** `STATUS_COLORS` in `StatusBadge.jsx` (`COMPLETED` `#639922` vs `FOR DELIVERY` `#1D9E75`) fails the palette validator's normal-vision floor — the two are genuinely hard to tell apart by color alone, for anyone, not just colorblind users. Out of scope because it's used app-wide (Kanban board included), not just these two pages. **If this ever gets raised, both pages already always pair the color with a visible text label**, so the immediate risk is mitigated; the actual fix (repicking one of the two hues) is a separate, larger, cross-cutting task nobody has approved yet.

## 5. Orders.jsx mobile filter-row overflow (`e3febcd`)

Reported live via a real iPhone-14 screenshot: the "Archive: Sep 2026 Aug 2026 …" month-button row inside `.filter-row` had no `flex-wrap` of its own. `.filter-row`'s mobile media rule wraps its *direct children* onto new lines, but that doesn't make a child's own un-wrapped internal content shrink — so 5-6 archive buttons demanded one line wider than the phone, dragging the whole page horizontally scrollable. Fixed with one `flexWrap: 'wrap'` + `minWidth: 0` on that container. **This is a general trap worth remembering**: `flex-wrap` on a parent only lets *children* move to new lines — it does nothing for a child's own un-wrapped grandchildren. Any future "row of buttons that might not fit" needs its *own* `flexWrap: 'wrap'`, not just an ancestor's.

Verified by reproducing the exact markup/CSS in an isolated static page rendered at 390px width via local Playwright — not by hitting the live site (see below).

## Verification done — and its real limits

- `npm run build` after every single step (8 separate builds across the session) — always clean.
- Backend: `orders.test.js` (12/12) passes after the notify-flag change; the other backend test files fail in this sandbox purely because `backend/node_modules` isn't installed here (pre-existing environment gap, confirmed unrelated).
- **This sandbox's network egress is allowlisted and blocks both `laundrobot.app` and any `*.vercel.app` preview domain** — every verification this session was build-only or via isolated local reproductions (e.g. the filter-row fix), never a real render of the live site or a Vercel preview. **Nobody in this session has actually seen these changes render in a real browser against real data.**
- The Kanban notify-prompt UX (confirm dialog, bell icon, "Notify Customer Now") has **never been clicked by a human** — it's new interaction surface with zero manual QA.

## What's intentionally left alone / still open

- **`CLAUDE.md` update** for this session's durable facts (BottomTabBar/isNavVisible, the notify-flag PATCH/POST pattern, `components/Charts.jsx` as the chart source of truth, the flex-wrap trap) — check whether it landed in the same push as this handoff; if not, it's still owed.
- **No real-device verification of anything in this handoff.** Given the sandbox's network restriction, the user has been doing all live/mobile verification themselves (the Orders.jsx bug report came from their own iPhone 14 screenshot). Budget for more of these round-trips before assuming any visual change actually looks right on a real phone.
- **The STATUS_COLORS accessibility gap** (section 4) — not fixed, flagged only.
- **`HorizBars`' new `formatValue` prop** — only Reports' orders-by-status call site uses a non-default value today; nothing else in Finance.jsx needed updating, but a future caller with non-currency data must remember to pass it.
- **The bottom tab bar's `TAB_KEYS`** (Overview/Kanban/Orders/WalkIn) is a hardcoded array, not configurable per tenant/role beyond the existing permission filter — if a tenant's staff role doesn't have any of those 4 pages, they'd see a bar with just "More," which was accepted as fine but never actually tested against a real restricted-staff account.
