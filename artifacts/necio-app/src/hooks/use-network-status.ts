import { useEffect, useState } from "react";

export type NetworkStatus = "online" | "offline" | "syncing";

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online"
  );

  useEffect(() => {
    function handleOnline() {
      setStatus("syncing");
    }
    function handleOffline() {
      setStatus("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function markSyncDone() {
    setStatus("online");
  }

  return { status, markSyncDone };
}
