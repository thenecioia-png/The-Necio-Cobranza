import { useState } from "react";
import { Link } from "wouter";
import { useGetClients } from "@workspace/api-client-react";
import { Users, Phone, MapPin, Search, Plus, ArrowRight, AlertTriangle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { formatDate, cn } from "@/lib/utils";

const STATUS_CONFIG = {
  active: { label: "Activo", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  delinquent: { label: "Moroso", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  uncollectible: { label: "Incobrable", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
};

const RISK_CONFIG = (score: number) => {
  if (score <= 30) return { label: "Bajo", color: "text-emerald-500" };
  if (score <= 60) return { label: "Medio", color: "text-amber-500" };
  return { label: "Alto", color: "text-red-500" };
};

export default function ClientList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "delinquent" | "uncollectible">("all");
  const { data: clients, isLoading } = useGetClients();

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-8">
          <div className="h-10 bg-card rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 bg-card rounded-2xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const filtered = clients?.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cedula?.includes(searchTerm) ||
      c.phone?.includes(searchTerm);
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  const delinquentCount = clients?.filter(c => c.status === "delinquent").length ?? 0;
  const uncollectibleCount = clients?.filter(c => c.status === "uncollectible").length ?? 0;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" /> Clientes
          </h1>
          <p className="text-muted-foreground mt-1">
            {clients?.length ?? 0} registrados
            {delinquentCount > 0 && <span className="text-amber-500 font-medium"> · {delinquentCount} moroso(s)</span>}
            {uncollectibleCount > 0 && <span className="text-red-500 font-medium"> · {uncollectibleCount} incobrable(s)</span>}
          </p>
        </div>

        <Link href="/clients/new" className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "delinquent", "uncollectible"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                filterStatus === s
                  ? "bg-primary text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "all" ? "Todos" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((client, idx) => {
          const statusCfg = STATUS_CONFIG[client.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
          const riskCfg = RISK_CONFIG(client.riskScore);
          return (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(idx * 0.05, 0.4) }}
              className={cn(
                "bg-card border rounded-2xl p-5 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 group",
                client.status === "delinquent" ? "border-amber-500/30" :
                client.status === "uncollectible" ? "border-red-500/30" :
                "border-border hover:border-primary/50"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold font-display text-foreground group-hover:text-primary transition-colors truncate">{client.name}</h3>
                  {client.cedula && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{client.cedula}</p>}
                </div>
                <div className={cn("ml-3 px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0", statusCfg.bg, statusCfg.color, statusCfg.border)}>
                  {statusCfg.label}
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" /> {client.phone}
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-1">{client.address}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground">
                    Riesgo: <span className={cn("font-semibold", riskCfg.color)}>{riskCfg.label}</span>
                  </div>
                </div>
                <Link href={`/clients/${client.id}`} className="text-primary hover:text-white flex items-center gap-1 text-sm font-bold transition-colors">
                  Ver <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
            No se encontraron clientes con ese criterio.
          </div>
        )}
      </div>
    </div>
  );
}
