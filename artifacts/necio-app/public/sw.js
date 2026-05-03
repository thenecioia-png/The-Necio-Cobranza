const CACHE_NAME = "necio-v2";
const DB_NAME = "necio-offline";
const STORE_NAME = "payment-queue";
const MAX_RETRIES = 5;

const PRECACHE = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queuePayment(payload) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    tx.objectStore(STORE_NAME).add({ ...payload, id, retries: 0, queuedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

async function getPendingPayments() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deletePayment(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updatePaymentRetries(id, retries) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const data = req.result;
      if (data) {
        data.retries = retries;
        store.put(data);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function syncPayments() {
  const payments = await getPendingPayments();
  if (!payments.length) return;

  let synced = 0;
  let failed = 0;

  for (const p of payments) {
    // Skip items that exceeded max retries
    if (p.retries >= MAX_RETRIES) {
      failed++;
      continue;
    }

    try {
      const res = await fetch(p.url, {
        method: p.method,
        headers: p.headers,
        body: p.body,
        credentials: "include",
      });

      if (res.ok) {
        await deletePayment(p.id);
        synced++;
      } else if (res.status === 409) {
        // Already paid (duplicate), safe to remove
        await deletePayment(p.id);
        synced++;
      } else {
        await updatePaymentRetries(p.id, (p.retries || 0) + 1);
        failed++;
      }
    } catch {
      await updatePaymentRetries(p.id, (p.retries || 0) + 1);
      failed++;
    }
  }

  if (synced > 0 || failed > 0) {
    const clients = await self.clients.matchAll();
    clients.forEach((c) =>
      c.postMessage({ type: "SYNC_COMPLETE", synced, failed })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercept payment POST calls when offline
  if (
    event.request.method === "POST" &&
    url.pathname.match(/\/api\/installments\/.+\/pay$/)
  ) {
    event.respondWith(
      fetch(event.request.clone()).catch(async (err) => {
        try {
          const body = await event.request.text();
          await queuePayment({
            url: event.request.url,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
          return new Response(
            JSON.stringify({ offline: true, message: "Pago guardado para sincronizar" }),
            { status: 202, headers: { "Content-Type": "application/json" } }
          );
        } catch (queueErr) {
          return new Response(
            JSON.stringify({ error: "No se pudo guardar el pago offline" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      })
    );
    return;
  }

  // API GET: Network first, then cache, and always update cache
  if (event.request.method === "GET" && url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || new Response(
          JSON.stringify({ error: "Sin conexión y sin datos en caché" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )))
    );
    return;
  }

  // Default: network first, then cache
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-payments") {
    event.waitUntil(syncPayments());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SYNC_NOW") {
    syncPayments();
  }
});
