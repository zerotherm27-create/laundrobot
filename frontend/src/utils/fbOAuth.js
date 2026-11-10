// Single source of truth for the Facebook OAuth redirect (Settings + SuperAdmin assisted connect).
// instagram_* scopes are still pending Meta App Review — requesting them from a user with no role
// on the app can strip them or fail the whole dialog. Only ask for them when the tenant already
// has an Instagram account linked, so reconnecting doesn't drop their IG permissions.
const BASE_SCOPES = ['pages_show_list', 'pages_manage_metadata', 'pages_messaging', 'pages_utility_messaging', 'pages_read_engagement', 'business_management'];
const IG_SCOPES = ['instagram_basic', 'instagram_manage_messages'];

// Returns an error string if the redirect can't start, otherwise navigates away.
export function startFbOAuth({ includeInstagram = false } = {}) {
  const appId = import.meta.env.VITE_FB_APP_ID;
  if (!appId) return 'Facebook App ID not configured — contact support.';
  const stateArray = new Uint8Array(16);
  crypto.getRandomValues(stateArray);
  const state = Array.from(stateArray).map(b => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem('fb_oauth_state', state);
  const redirectUri = window.location.origin + '/settings';
  const scopes = includeInstagram ? [...BASE_SCOPES, ...IG_SCOPES] : BASE_SCOPES;
  window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(',')}&response_type=code&state=${state}`;
  return null;
}
