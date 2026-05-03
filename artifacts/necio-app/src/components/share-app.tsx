import { Share2, Link2, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const SHARE_TEXT = `Gestiona tu cobranza como un profesional con *The Necio Cobranza* — préstamos, cuotas, GPS, cobros offline y facturas por WhatsApp. Todo desde tu celular.\n\nInstálala gratis:\nhttps://necio-cobranza-production.up.railway.app`;

export function ShareAppButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = "https://necio-cobranza-production.up.railway.app";
    const text = "Gestiona tu cobranza como un profesional con The Necio Cobranza — préstamos, cuotas, GPS, cobros offline y facturas por WhatsApp.";

    // Native Web Share API (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "The Necio Cobranza",
          text,
          url,
        });
        return;
      } catch {
        // User cancelled or share failed — fallback below
      }
    }

    // WhatsApp fallback
    const waUrl = `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText("https://necio-cobranza-production.up.railway.app");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleShare}
        title="Compartir app"
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
      >
        <Share2 className="w-4 h-4" />
        <span>Compartir app</span>
      </button>

      <button
        onClick={handleCopyLink}
        title="Copiar link"
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
      >
        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
        <span>{copied ? "Link copiado" : "Copiar link"}</span>
      </button>
    </div>
  );
}
