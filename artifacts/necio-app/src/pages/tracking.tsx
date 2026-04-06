import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Wifi, WifiOff, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "@/components/client-avatar";
import "leaflet/dist/leaflet.css";

const API = "/api";

interface CobradorGPS {
  cobradorId: number;
  name: string;
  avatarUrl: string | null;
  lat: number;
  lng: number;
  updatedAt: string;
  enLinea: boolean;
  cobrosHoy: number;
}

function fetchTracking(): Promise<CobradorGPS[]> {
  return fetch(`${API}/tracking/cobradores`, { credentials: "include" }).then((r) => r.json());
}

function formatHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

export default function Tracking() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());

  const { data: cobradores = [], isLoading } = useQuery<CobradorGPS[]>({
    queryKey: ["tracking"],
    queryFn: fetchTracking,
    refetchInterval: 20_000, // actualiza cada 20 seg
  });

  // Inicializar mapa una sola vez
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    import("leaflet").then((L) => {
      // Fix default marker icons (webpack/vite issue with Leaflet)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [18.4861, -69.9312], // Santo Domingo, RD
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletMap.current = map;
    });

    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, []);

  // Actualizar marcadores cuando cambia la data
  useEffect(() => {
    if (!leafletMap.current || cobradores.length === 0) return;

    import("leaflet").then((L) => {
      const map = leafletMap.current;
      const currentIds = new Set(cobradores.map((c) => c.cobradorId));

      // Remover marcadores que ya no están
      markersRef.current.forEach((marker, id) => {
        if (!currentIds.has(id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      });

      // Agregar/actualizar marcadores
      cobradores.forEach((cob) => {
        const color = cob.enLinea ? "#e11d48" : "#6b7280";
        const iconHtml = `
          <div style="
            background: ${color};
            width: 36px; height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
          ">
            <div style="transform: rotate(45deg); color: white; font-size: 16px;">👤</div>
          </div>`;

        const icon = L.divIcon({
          html: iconHtml,
          className: "",
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        });

        const popupContent = `
          <div style="font-family: sans-serif; min-width: 140px;">
            <strong style="font-size: 14px;">${cob.name}</strong><br/>
            <span style="color: ${cob.enLinea ? "#16a34a" : "#9ca3af"}; font-size: 12px;">
              ${cob.enLinea ? "● En línea" : "○ Desconectado"}
            </span><br/>
            <span style="font-size: 12px; color: #6b7280;">Último ping: ${formatHora(cob.updatedAt)}</span><br/>
            <span style="font-size: 12px;">Cobros hoy: <strong>${cob.cobrosHoy}</strong></span>
          </div>`;

        if (markersRef.current.has(cob.cobradorId)) {
          const m = markersRef.current.get(cob.cobradorId);
          m.setLatLng([cob.lat, cob.lng]);
          m.setIcon(icon);
          m.setPopupContent(popupContent);
        } else {
          const marker = L.marker([cob.lat, cob.lng], { icon })
            .addTo(map)
            .bindPopup(popupContent);
          markersRef.current.set(cob.cobradorId, marker);
        }
      });

      // Ajustar vista si hay cobradores en línea
      const enLinea = cobradores.filter((c) => c.enLinea);
      if (enLinea.length > 0 && markersRef.current.size > 0) {
        const bounds = L.latLngBounds(enLinea.map((c) => [c.lat, c.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
    });
  }, [cobradores]);

  const enLinea = cobradores.filter((c) => c.enLinea);
  const desconectados = cobradores.filter((c) => !c.enLinea);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h1 className="font-display font-bold text-lg">Mapa GPS en Vivo</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-green-500">
            <Wifi className="w-4 h-4" />
            {enLinea.length} en línea
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <WifiOff className="w-4 h-4" />
            {desconectados.length} fuera
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Mapa */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <div className="text-muted-foreground text-sm animate-pulse">Cargando mapa...</div>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Panel lateral cobradores */}
        <div className="hidden md:flex w-72 flex-col border-l border-border bg-card overflow-y-auto">
          {/* En línea */}
          {enLinea.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-green-500 uppercase tracking-wider border-b border-border/50 bg-green-500/5">
                En línea ({enLinea.length})
              </div>
              {enLinea.map((cob) => (
                <CobradorCard
                  key={cob.cobradorId}
                  cob={cob}
                  onLocate={() => {
                    leafletMap.current?.setView([cob.lat, cob.lng], 16);
                    markersRef.current.get(cob.cobradorId)?.openPopup();
                  }}
                />
              ))}
            </div>
          )}

          {/* Desconectados */}
          {desconectados.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                Desconectados ({desconectados.length})
              </div>
              {desconectados.map((cob) => (
                <CobradorCard key={cob.cobradorId} cob={cob} />
              ))}
            </div>
          )}

          {cobradores.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center gap-2">
              <User className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Ningún cobrador activo ahora</p>
              <p className="text-xs text-muted-foreground/60">Se actualiza cada 20 segundos</p>
            </div>
          )}
        </div>
      </div>

      {/* Lista mobile debajo del mapa */}
      {cobradores.length > 0 && (
        <div className="md:hidden border-t border-border bg-card max-h-40 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 p-3">
            {cobradores.map((cob) => (
              <button
                key={cob.cobradorId}
                onClick={() => {
                  leafletMap.current?.setView([cob.lat, cob.lng], 16);
                  markersRef.current.get(cob.cobradorId)?.openPopup();
                }}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg text-left text-sm",
                  cob.enLinea ? "bg-green-500/10 border border-green-500/20" : "bg-muted/30 border border-border"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full shrink-0", cob.enLinea ? "bg-green-500" : "bg-muted-foreground")} />
                <div className="min-w-0">
                  <p className="font-medium truncate text-xs">{cob.name}</p>
                  <p className="text-[10px] text-muted-foreground">{cob.cobrosHoy} cobros</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CobradorCard({ cob, onLocate }: { cob: CobradorGPS; onLocate?: () => void }) {
  return (
    <button
      onClick={onLocate}
      disabled={!onLocate}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 text-left transition-colors",
        onLocate ? "hover:bg-muted/30 cursor-pointer" : "cursor-default opacity-60"
      )}
    >
      <div className="relative shrink-0">
        <ClientAvatar name={cob.name} avatarUrl={cob.avatarUrl} size="sm" />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
            cob.enLinea ? "bg-green-500" : "bg-muted-foreground"
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{cob.name}</p>
        <p className="text-xs text-muted-foreground">
          {cob.enLinea ? `Último ping: ${formatHora(cob.updatedAt)}` : "Sin señal"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-primary">{cob.cobrosHoy}</p>
        <p className="text-[10px] text-muted-foreground">cobros</p>
      </div>
    </button>
  );
}
