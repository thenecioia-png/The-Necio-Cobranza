import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { syncQueue, queueSize } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { status, markSyncDone } = useNetworkStatus();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setPendingCount(queueSize());
  }, [status]);

  useEffect(() => {
    if (status !== "syncing") return;

    async function doSync() {
      setSyncProgress("Sincronizando...");
      const { ok, failed } = await syncQueue((done, total, label) => {
        setSyncProgress(`Sincronizando ${done + 1} de ${total}: ${label}`);
      });

      await queryClient.invalidateQueries();
      setPendingCount(queueSize());

      if (failed === 0) {
        setSyncProgress(ok > 0 ? `${ok} operación${ok > 1 ? "es" : ""} sincronizada${ok > 1 ? "s" : ""}` : "");
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          markSyncDone();
        }, 2500);
      } else {
        setSyncProgress(`${ok} sincronizadas, ${failed} fallaron`);
        setTimeout(() => markSyncDone(), 3000);
      }
    }

    doSync();
  }, [status]);

  if (status === "online" && !showSuccess) return null;

  if (showSuccess) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-semibold py-2 px-4 shadow-lg animate-in slide-in-from-top duration-300">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>✅ Conexión restaurada{syncProgress ? ` · ${syncProgress}` : ""}</span>
      </div>
    );
  }

  if (status === "syncing") {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-semibold py-2 px-4 shadow-lg animate-in slide-in-from-top duration-300">
        <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
        <span>{syncProgress || "Restaurando conexión..."}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-zinc-800 border-b border-zinc-700 text-white text-sm font-semibold py-2 px-4 shadow-lg",
        "animate-in slide-in-from-top duration-300"
      )}
    >
      <WifiOff className="w-4 h-4 shrink-0 text-red-400" />
      <span>
        📡 Sin conexión
        {pendingCount > 0
          ? ` · ${pendingCount} operación${pendingCount > 1 ? "es" : ""} guardada${pendingCount > 1 ? "s" : ""} localmente`
          : " · guardando local"}
      </span>
      <span className="ml-2 text-xs text-zinc-400 font-normal">Se sincronizará al restaurar</span>
    </div>
  );
}
