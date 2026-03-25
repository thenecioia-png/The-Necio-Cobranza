const QUEUE_KEY = "necio_offline_queue";

export interface QueuedOperation {
  id: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body: unknown;
  label: string;
  timestamp: number;
}

export function getQueue(): QueuedOperation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOperation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(op: Omit<QueuedOperation, "id" | "timestamp">) {
  const queue = getQueue();
  queue.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() });
  saveQueue(queue);
}

export function removeFromQueue(id: string) {
  const queue = getQueue().filter(op => op.id !== id);
  saveQueue(queue);
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function queueSize(): number {
  return getQueue().length;
}

export async function syncQueue(
  onProgress?: (done: number, total: number, label: string) => void
): Promise<{ ok: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { ok: 0, failed: 0 };

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const op = queue[i];
    onProgress?.(i, queue.length, op.label);
    try {
      const res = await fetch(op.url, {
        method: op.method,
        headers: { "Content-Type": "application/json" },
        body: op.body != null ? JSON.stringify(op.body) : undefined,
      });
      if (res.ok) {
        removeFromQueue(op.id);
        ok++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { ok, failed };
}
