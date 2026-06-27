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

export async function syncPendingOrders(createFn) {
  const orders = await getPendingOrders();
  if (!orders.length) return { synced: 0, failed: 0 };
  let synced = 0, failed = 0;
  for (const order of orders) {
    try {
      await createFn(order.payload);
      await removePendingOrder(order.id);
      synced++;
    } catch (err) {
      if (err.response) {
        // Server rejected (bad payload) — remove to avoid infinite retry
        await removePendingOrder(order.id);
        failed++;
      }
      // Network error — leave in queue for next retry
    }
  }
  return { synced, failed };
}
