import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (element: Element, config: object) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const API_BASE = "/api";

export function GoogleSignInButton() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/auth/google/client-id`)
      .then(r => r.json())
      .then(data => { if (data.clientId) setClientId(data.clientId); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientId) return;

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google) { setScriptReady(true); }
      else { existing.addEventListener("load", () => setScriptReady(true)); }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
  }, [clientId]);

  useEffect(() => {
    if (!scriptReady || !clientId || !buttonRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      context: "signin",
      ux_mode: "popup",
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "filled_black",
      size: "large",
      width: buttonRef.current.clientWidth || 400,
      text: "signin_with",
      shape: "rectangular",
      locale: "es_419",
    });
  }, [scriptReady, clientId]);

  async function handleCredential(response: { credential: string }) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/google/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "No se pudo iniciar sesión con Google",
        });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "¡Bienvenido!", description: `Hola, ${data.user.name}` });
      setLocation(data.user.role === "cobrador" ? "/today" : "/dashboard");
    } catch {
      toast({
        variant: "destructive",
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!clientId) return null;

  return (
    <div className="relative w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded z-10">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        </div>
      )}
      <div ref={buttonRef} className="w-full flex justify-center" />
    </div>
  );
}
