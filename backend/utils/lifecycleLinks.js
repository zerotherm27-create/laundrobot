// Signed links used in the automated trial emails ("reopen my trial", "unsubscribe").
// Stateless: the token carries the tenant id + the one action it allows.
const jwt = require('jsonwebtoken');

// NOT the session secret itself: a derived key, so an emailed link token can never be replayed as a
// login session (middleware/auth.js verifies with the bare JWT_SECRET) and a session token can never
// be used as a link.
const secret = () => `${process.env.JWT_SECRET}:lifecycle-link`;

// action → expiry (unsubscribe links never expire). 'plan' opens the no-login plan page for that shop.
const ACTIONS = { extend: '30d', plan: '60d', unsub: null };

function signLink(tenantId, action) {
  if (!(action in ACTIONS)) throw new Error(`Unknown link action: ${action}`);
  const opts = ACTIONS[action] ? { expiresIn: ACTIONS[action] } : {};
  return jwt.sign({ t: tenantId, a: action }, secret(), opts);
}

// Returns the tenant id, or null when the token is invalid, expired, or for a different action.
function verifyLink(token, action) {
  try {
    const p = jwt.verify(String(token || ''), secret());
    return p && p.a === action && p.t ? p.t : null;
  } catch { return null; }
}

function appUrl() {
  // Same domain as the From address (laundrobot.app) — link/sender alignment helps deliverability.
  return (process.env.APP_URL || 'https://laundrobot.app').replace(/\/$/, '');
}

function buildLinks(tenantId, verifyToken) {
  const base = appUrl();
  return {
    app:         `${base}/login`,
    // No login: the token identifies the shop; the page (PlanLink.jsx) lets the owner pick a plan and pay.
    subscribe:   `${base}/?plan_token=${signLink(tenantId, 'plan')}`,
    extend:      `${base}/?extend_trial=${signLink(tenantId, 'extend')}`,
    unsubscribe: `${base}/?unsubscribe=${signLink(tenantId, 'unsub')}`,
    ...(verifyToken ? { verify: `${base}/?verify_token=${verifyToken}` } : {}),
  };
}

module.exports = { signLink, verifyLink, buildLinks };
