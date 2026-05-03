import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        // Register background sync for offline payments
        const regAny = reg as any;
        if (regAny.sync) {
          regAny.sync.register("sync-payments").catch(() => {});
        }
      })
      .catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
