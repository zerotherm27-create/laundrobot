# Handoff — Landing page audit & dashboard cleanup

**Date:** 2026-08-07
**Scope:** `frontend/src/pages/Landing.jsx`, plus a smaller emoji/color cleanup across ~17 dashboard files.
**Commits:** `f109d11..b09072f` on `main` (3 commits, all pushed and live).

---

## What changed, in order

### 1. `/impeccable audit` pass on Landing.jsx (commit `1b54405`)

Ran a technical audit against accessibility, performance, theming, responsive, and anti-pattern checks. Score went from **9/20 (Poor) → 17/20 (Good)**. Fixes:

- **Reveal-gated content (P0):** `useFadeUp` used to set `opacity: 0` by default and only reveal via `IntersectionObserver`. If JS errored, was blocked, or the observer never fired, sections shipped permanently blank. Now content is visible by default (`.reveal` class carries `opacity: 1`); the observer only *adds* a `.reveal-in` entrance animation on top.
- **Motion accessibility:** added `@media (prefers-reduced-motion: reduce)` handling (previously absent entirely). The Messenger phone mockup now freezes on a static frame for reduced-motion users and pauses its auto-cycle when scrolled out of view.
- **Design tokens:** reconciled ~191 hardcoded hex colors to `var(--token)` references. Added `--primary-tint-dark` / `--primary-tint-text` to `frontend/index.html`. Caught and fixed a regression from this pass — `${bg}18` string-concatenation alpha hacks broke once `bg` became a `var()` string; replaced with `color-mix(in srgb, ${bg} 9%, transparent)`.
- **TrustBar contrast:** white text was ~2.8–3.3:1 against a light gradient (WCAG fail). Darkened to the `--primary`/`--primary-dark` gradient, now ≥6.4:1.
- **Anti-pattern cleanup:** removed the repeated uppercase eyebrow-pill kicker from 5 of 6 sections (kept one, on Testimonials, as a deliberate single kicker). Deleted 11 lines of dead `.l-mascot-*` CSS.
- **Assets:** `logo.png` 272KB→8KB, `mascot.png` 1MB→49KB (both resized to actual display size), hero video got a poster frame + `preload="metadata"`.
- **Touch targets:** hamburger, nav CTAs, and pricing toggle bumped to 44px.

### 2. Purple reconciliation + dashboard emoji cleanup (commit `1b54405`, same push)

- Discovered `#7C3AED` is the dashboard's real, established purple (used in 11 files for "Pro tier" and "promo/discount" indicators), while Landing.jsx and `StatusBadge.jsx` used a different purple (`#7F77DD`). Reconciled by updating the `--purple` / `--purple-bg` tokens in `index.html` (auto-fixes Landing.jsx) and `StatusBadge.jsx` directly — **not** the other way around.
- Replaced ✓/✗/✅/❌ emoji-as-icon usage with the `Icon` component across 16 files (CreateOrderModal, DeliveryZones, ResetPassword, WalkIn, Customers, PaywallScreen, FAQs, Reports, Overview, Settings, Services, Messaging, Finance, Kanban, Users, BookingForm, Orders, Sidebar). Scoped strictly to those four glyphs — left alone: message-string-with-`.startsWith()` patterns (Settings/Branches/SuperAdmin/Sidebar/Finance — would need a real refactor, not just a swap), mixed-glyph ternaries (e.g. `✅`/`⚠️`/`❌` in one expression), and `ThermalReceipt.jsx` (its `✓ PAID` is literal text printed to a physical receipt, not UI).
- BookingForm.jsx has its own local `Icon` component with different naming (`checkCircle` not `check-circle`) — caught a build-breaking duplicate-declaration collision from this before it shipped.

### 3. Features section redesign (commit `1b54405`, user-flagged)

The 6-card feature grid (colored top-stripe borders + icon + uppercase label pill + title + desc, repeated identically 6×) was called out directly as reading like AI-generated template slop. Replaced with a two-column divided-row list — icon, title, description, hairline dividers — matching the non-card language the "How it works" section already used elsewhere on the same page. Also fixed a contrast issue this surfaced: the "AI" row's icon needed `var(--warning)` instead of `var(--accent)` (bright yellow icon on a light-yellow tint would've been nearly invisible once it moved from a solid icon square to a tinted background).

### 4. Motion pass (commit `b09072f`)

Applied `emil-design-eng` principles:

- Replaced 6 `transition: 'all .15s'` sites with named properties + a custom `--l-ease-out` curve (`cubic-bezier(.23, 1, .32, 1)`).
- Added real `:active` press feedback (`scale(.97)`) to every CTA — they're `<a>` tags, so they had `:hover` via JS but zero press feedback before this.
- Animated the FAQ accordion's expand/collapse via a CSS grid-rows collapse (was an instant conditional mount — content just appeared/disappeared with no transition).
- Fixed weak/wrong easing: mobile drawer now uses an iOS-style `--l-ease-drawer` curve instead of plain `ease`; Messenger-mockup message entrance and FAQ chevron rotation use custom `ease-out`/`ease-in-out` instead of browser defaults.

---

## Verification done

- `npx vite build` clean after every change.
- FAQ accordion mechanism verified via computed styles in-browser (`grid-template-rows` toggles `0px` ↔ content height, `is-open` class and `aria-hidden` track correctly, transition uses the custom cubic-bezier).
- Feature-row redesign verified visually at desktop and mobile widths, including the divider seam where the two mobile-stacked columns meet.
- Color-mix regression fix verified via computed styles (`color(srgb ... / 0.09)` resolving correctly).

**Not verified live:** most of the emoji→Icon dashboard edits (Settings, Kanban, Finance, etc.) are behind staff login; no test credentials were available this session. Verified via build success + structural code review (parent flex context, icon name matching) instead. If something looks visually off in one of those 16 files, check there first.

## What's intentionally left alone

- Group B emoji pattern (message string baked with emoji + `.startsWith()`/`.includes()` parsing for styling) in Settings.jsx, Branches.jsx, SuperAdmin.jsx, Sidebar.jsx, Finance.jsx — fixing properly means separating the success/fail flag from the message text, not a cosmetic swap. Skipped per explicit scope decision.
- Hero video wasn't re-encoded — its existing bitrate (~100kbps) was already lean for its length; a poster frame + `preload="metadata"` was the actual win. Re-encoding attempts (WebM) made the file *larger*, so that was reverted.
- `frontend/dist/`, `frontend/node_modules/`, and `.DS_Store` files show as modified/tracked in `git status` — this is pre-existing repo debt (they're `.gitignore`d now but were committed before that rule existed). Not touched; out of scope.
