// Offline sign-in. After every successful ONLINE login the session (token + profile) is
// encrypted with a key derived from the user's own password (PBKDF2 → AES-GCM) and kept in
// IndexedDB. Offline, a correct email + password decrypts it and restores the session; a wrong
// password simply fails to decrypt. No plaintext token or password hash is stored, so signing
// out leaves nothing usable without the password.
const DB_NAME = 'laundrobot-offline-auth';
const STORE = 'sessions';
const ITERATIONS = 150000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const keyOf = email => String(email || '').trim().toLowerCase();

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export const offlineAuthSupported = () =>
  typeof indexedDB !== 'undefined' && !!(globalThis.crypto && crypto.subtle);

// session = { token, persistent, profile: { role, tenant_id, tenant_name, email, permissions } }
export async function saveOfflineSession(email, password, session) {
  if (!offlineAuthSupported()) return;
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(session)));
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ salt: b64(salt), iv: b64(iv), data: b64(data), savedAt: Date.now() }, keyOf(email));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* offline sign-in is a convenience; never break a normal login */ }
}

// Returns the session on a correct password, or null (no saved session on this device / wrong password).
export async function openOfflineSession(email, password) {
  if (!offlineAuthSupported()) return null;
  try {
    const db = await openDB();
    const rec = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(keyOf(email));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (!rec) return null;
    const key = await deriveKey(password, unb64(rec.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.data));
    return JSON.parse(dec.decode(plain));
  } catch { return null; }
}
