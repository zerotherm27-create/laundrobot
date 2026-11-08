const DB_NAME = 'laundrobot-walkin';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
      if (!db.objectStoreNames.contains('pendingOrders')) {
        db.createObjectStore('pendingOrders', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWalkInCache(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put({ ...data, savedAt: Date.now() }, 'data');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadWalkInCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', 'readonly');
    const req = tx.objectStore('cache').get('data');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOrder(payload) {
  const db = await openDB();
  const tempRef = `OFFLINE-${String(Date.now()).slice(-6)}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingOrders', 'readwrite');
    const req = tx.objectStore('pendingOrders').add({ payload, tempRef, savedAt: Date.now() });
    req.onsuccess = () => resolve(tempRef);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOrders() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingOrders', 'readonly');
    const req = tx.objectStore('pendingOrders').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingOrder(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingOrders', 'readwrite');
    tx.objectStore('pendingOrders').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// Keep an order the server rejected so staff can see it and retry or discard it.
// It is skipped by automatic syncs (no endless retry) until retried manually.
export async function markOrderFailed(id, message) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingOrders', 'readwrite');
    const store = tx.objectStore('pendingOrders');
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) store.put({ ...req.result, failed: true, error: message, failedAt: Date.now() });
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// Guard so the timer, the online event and the button can't send the same order twice.
let _syncing = false;

export async function syncPendingOrders(createFn, { retryFailed = false } = {}) {
  if (_syncing) return { synced: 0, failed: 0, skipped: true };
  _syncing = true;
  try {
    const orders = (await getPendingOrders()).filter(o => retryFailed || !o.failed);
    let synced = 0, failed = 0;
    for (const order of orders) {
      try {
        await createFn(order.payload);
        await removePendingOrder(order.id);
        synced++;
      } catch (err) {
        if (err.response) {
          // Server rejected it — keep it in the queue, flagged, instead of deleting it
          const msg = err.response.data?.error || `Server error ${err.response.status}`;
          await markOrderFailed(order.id, msg).catch(() => {});
          failed++;
        }
        // Network error — leave in queue for next retry
      }
    }
    return { synced, failed };
  } finally {
    _syncing = false;
  }
}
