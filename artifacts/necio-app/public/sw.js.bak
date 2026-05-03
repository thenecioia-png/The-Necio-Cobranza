const CACHE_NAME = "necio-v1";
const DB_NAME = "necio-offline";
const STORE_NAME = "payment-queue";

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
    )
  );
  self.clients.claim();
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queuePayment(payload) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(payload);
    tx.oncomplete = () => resolve();
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

async function clearQueue() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function syncPayments() {
  const payments = await getPendingPayments();
  if (!payments.length) return;

  let synced = 0;
  for (const p of payments) {
    try {
      const res = await fetch(p.url, {
        method: p.method,
        headers: p.headers,
        body: p.body,
        credentials: "include",
      });
      if (res.ok) synced++;
    } catch {}
  }

  if (synced > 0) {
    await clearQueue();
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.postMessage({ type: "SYNC_COMPLETE", synced }));
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
      fetch(event.request.clone()).catch(async () => {
        const body = await event.request.text();
        await queuePayment({
          url: event.request.url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          queuedAt: new Date().toISOString(),
        });
        return new Response(
          JSON.stringify({ offline: true, message: "Pago guardado para sincronizar" }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Cache GET API responses for offline use
  if (event.request.method === "GET" && url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Default: network first, then cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
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
