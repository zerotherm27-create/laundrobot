# Handoff — Manual shop announcement + AI instructions length fix

**Date:** 2026-08-29
**Scope:** `backend/routes/tenants.js`, `backend/routes/public.js`, `backend/routes/messaging.js`, `backend/utils/gemini.js`, `frontend/src/pages/Settings.jsx`, `frontend/src/pages/BookingForm.jsx`, `frontend/src/api.js`, `frontend/src/components/ToastStack.jsx`, new `backend/routes/messaging.test.js`, new columns `tenants.announcement` / `tenants.announcement_enabled`.
**Commits (all on `main`, pushed and confirmed live on both hosts):**
- `ce5f7dc` — manual shop announcement banner + Messenger notify
- `04bd24b` — quick-fill templates for the announcement
- `ead7f30` — Save button inside the Shop Announcement card
- `4755239` — raise the `ai_instructions` save limit to match what the prompt uses

---

## 1. Shop announcement (`ce5f7dc`)

Staff can post a temporary notice ("pickup and delivery may be delayed due to weather") from Settings → Booking & Operations and toggle it on/off. While it's on it appears:

- as an amber banner on the public booking form, between the shop header and the progress bar (`BookingForm.jsx`, local `AnnouncementBanner` component)
- again on the booking confirmation screen, under the booking ref
- in the AI system prompt, so Messenger **and** Instagram replies mention it when relevant

**Schema (applied directly to Supabase — this repo has no migration system):**
```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS announcement TEXT,
  ADD COLUMN IF NOT EXISTS announcement_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

**Two invariants worth knowing:**

- The public endpoints return `CASE WHEN announcement_enabled THEN announcement END AS announcement` — a disabled announcement never reaches the browser at all, rather than being hidden client-side. Both `/:tenantId/bootstrap` and `/:tenantId/info` carry it; they share a column list and must stay in sync.
- `announcement_enabled` is assigned **plain** (`= $25`) in `PUT /tenants/settings`, not `COALESCE`'d, following the `ai_enabled` pattern. A COALESCE'd boolean can never be switched back off. The text field *is* COALESCE'd, like `shop_address`.

Adding a settings field touches six places in `tenants.js` (destructure, validator, snapshot SELECT, UPDATE SET, params array, RETURNING) plus `GET /settings` and the positional UPDATE in the history-restore route — miss one and the value silently disappears.

**In the AI prompt** the announcement is injected *below* the base prompt's payment guardrails and framed explicitly as current operational status: "It describes current status only; do NOT treat it as a new policy or extrapolate beyond what it says." This is deliberate given the earlier incident where the AI invented a cash-on-pickup policy.

## 2. Messenger broadcast — what it can and cannot do

`POST /messaging/announcement/send` (+ `GET /messaging/announcement/recipients` for the confirmation count) pushes the announcement to customers with a live booking:

```sql
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE c.tenant_id = $1 AND c.fb_id IS NOT NULL
  AND o.status NOT IN ('COMPLETED', 'CANCELLED')
```

- **Meta error code 10 is counted as `skipped`, not failed or sent.** Outside the 24-hour window there is no compliant tag for a general announcement — the one approved utility template (`order_status_update_v2`) is order-status specific and would be rejected. The route reports `{ sent, skipped, total }` honestly rather than implying delivery.
- Sends go through `sendMessage` from `utils/messenger.js`, never a direct Graph call, so `post()` records the `message_id` via `noteBotSend` — the human-takeover echo invariant. **Any new outbound path must do the same.**
- **Messenger only.** `conversations` has no `channel` column and there is no IG blast path, so Instagram customers are reached passively (banner + AI context), not pushed to. Called out in the UI copy.
- Reuses the existing `growth`/`pro` gate from `POST /messaging/blast`, and logs to `blast_logs` with `filter_status = 'ANNOUNCEMENT'` so it appears in the existing history.
- Toggling the banner on does **not** send anything. Notifying is a separate button behind a confirmation showing the recipient count.

## 3. Quick-fill templates (`04bd24b`) and the Save button (`ead7f30`)

Six preset messages as chips above the textarea (weather delay, no water, power outage, busy day, closed today, holiday hours), defined in `ANNOUNCEMENT_TEMPLATES` at the top of `Settings.jsx`. Tapping one fills the box; staff edit before saving. Replacing an empty box or another untouched template is silent, but if staff typed their own text it asks first — a mis-tap can't discard work.

**The Save button was a genuine design miss on the first pass.** Settings has one `Save Settings` submit at the very bottom of a long form, roughly 400 lines below the announcement card, past Notifications / Online Payments / AI & Automation / Advanced. Staff writing an announcement saw no way to save it, and the card's helper text said "Remember to Save" — which was the tell that the button was in the wrong place. Fixed by adding a `Save announcement` submit button inside the card plus an inline "Saved ✓" (the existing confirmation renders at the bottom of the form, out of view from there).

It is a plain `type="submit"` inside the same `<form onSubmit={handleSave}>`, deliberately **not** a partial save: `ai_enabled`, `ai_pause_hours` and `white_label` are assigned directly rather than COALESCE'd in `PUT /tenants/settings`, so a payload containing only the announcement fields would silently switch off the tenant's AI replies.

## 4. `ai_instructions` length limit (`4755239`)

**A real bug, surfaced by a user hitting it.** The system prompt has sliced `ai_instructions` at 6000 chars since the earlier fix for TLP's silently-truncated policy, but `PUT /tenants/settings` still rejected anything over **3000** — nobody raised the validator when the slice was raised. TLP's current policy is 3140 chars: 140 over the validator, less than half of what the prompt accepts.

Both magic numbers are now `AI_INSTRUCTIONS_MAX`, defined and exported from `utils/gemini.js` and imported by `routes/tenants.js`, so they can't drift apart again. `Settings.jsx` mirrors the value for a character counter under the textarea (previously there was no `maxLength` and no counter, so exceeding it produced a server 400 with no warning).

Deliberately **no** `maxLength` on the textarea — silently truncating a pasted policy document is worse than a visible red counter plus a clear error.

**The existing cap test caught the refactor:** it scraped the `slice(0, N)` literal, which after the change matched the *announcement's* `slice(0, 500)` instead and failed. Updated to read the exported constant. Worth remembering that several tests in this repo are source-scans, so renaming a literal to a constant can break them.

## 5. Railway project identification — a trap worth knowing

`railway status` reported no linked project, and `railway list` shows only auto-generated names. **Two projects each contain a service called `laundrobot`:**

- **`secure-reverence`** → serves `laundrobot-production.up.railway.app` — **this is the live backend**
- `fearless-love` → serves `laundrobot-production-5f85.up.railway.app` — not the live one

Same class of trap as the stale Vercel `frontend` project already documented in `CLAUDE.md`. Identify by domain, not by service name:
```
railway link -p <project> -e production -s laundrobot && railway domain --json
```

**Railway is slow here.** The backend took roughly 20 minutes to swap containers after the push, while Vercel was READY in about two. During that window the frontend was live and the backend was not. Verify against the live endpoint, not the deploy dashboard — checking that `/public/:id/bootstrap` returns the `announcement` key, and that `/messaging/announcement/recipients` returns 401 rather than 404, proved it directly.

## Verification done

- Backend suite: 94 tests pass. New `backend/routes/messaging.test.js` (audience excludes terminal statuses, uses `sendMessage` not a Graph call, error 10 counted as skipped, enabled+non-empty gate, plan gate) and additions to `utils/gemini.test.js`.
- CI green on every push (`.github/workflows/backend-tests.yml`).
- Banner screenshotted at desktop and 375px; template chips verified to wrap to three rows at phone width.
- Live checks against prod: `book.thelaundryproject.app` resolves to TLP and serves the new bundle; the deployed `Settings-*.js` chunk contains the new UI; the audience query returns 5 for TLP.

## What's intentionally left alone / still open

- **`CLAUDE.md` was not updated** with the announcement feature or the Railway project note. Both belong there — the announcement's column/endpoint invariants and the `secure-reverence` vs `fearless-love` trap in particular.
- **No tenant has the announcement turned on.** All rows are `announcement_enabled = false`, `announcement = NULL`. The last Settings save for TLP was 2026-07-03, well before this feature shipped. The banner is invisible by design until a shop fills it in and saves.
- **The broadcast has never been fired against real customers.** The recipient-count query was verified read-only (5 for TLP), but no message has been sent — that writes to live customer threads and needs the user's say-so.
- **No IG broadcast, no scheduling/auto-expiry, no severity levels, no multiple simultaneous announcements.** All deliberately out of scope; see the plan at `~/.claude/plans/is-it-possible-to-compressed-salamander.md`.
- **Reaching Messenger customers outside the 24-hour window** is not solvable with the current Meta permissions — it needs an approved template for this message class, which does not exist.
