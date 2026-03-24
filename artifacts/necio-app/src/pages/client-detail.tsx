import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetClient, useUpdateClient, getGetClientQueryKey, getGetClientsQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatRD, formatDate, cn } from "@/lib/utils";
import { User, Phone, MapPin, CreditCard, Calendar, Plus, ArrowLeft, CheckCircle2, Clock, AlertTriangle, Shield, SlidersHorizontal } from "lucide-react";

const STATUS_CONFIG = {
  active: { label: "Activo", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  delinquent: { label: "Moroso", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  uncollectible: { label: "Incobrable", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
};

const RISK_CONFIG = (score: number) => {
  if (score <= 30) return { label: "Bajo Riesgo", color: "text-emerald-500", bg: "bg-emerald-500/10" };
  if (score <= 60) return { label: "Riesgo Medio", color: "text-amber-500", bg: "bg-amber-500/10" };
  return { label: "Alto Riesgo", color: "text-red-500", bg: "bg-red-500/10" };
};

export default function ClientDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [newRisk, setNewRisk] = useState<number | null>(null);

  const { data: client, isLoading, isError } = useGetClient(id);

  const updateMutation = useUpdateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "Cliente actualizado", description: "Los cambios se guardaron correctamente." });
        setShowStatusPanel(false);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el cliente." });
      }
    }
  });

  const handleStatusChange = (status: "active" | "delinquent" | "uncollectible") => {
    updateMutation.mutate({ id, data: { status } });
  };

  const handleRiskChange = () => {
    if (newRisk === null) return;
    updateMutation.mutate({ id, data: { riskScore: newRisk } });
    setNewRisk(null);
  };

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Cargando datos del cliente...</div>;
  }

  if (isError || !client) {
    return <div className="p-12 text-center text-destructive">Error al cargar cliente.</div>;
  }

  const statusCfg = STATUS_CONFIG[client.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
  const riskCfg = RISK_CONFIG(client.riskScore);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
      </div>

      <div className={cn("bg-card border rounded-3xl p-7 shadow-xl mb-6", statusCfg.border)}>
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="flex gap-5 items-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-rose-900 flex items-center justify-center text-3xl text-white font-display shadow-lg shadow-primary/20 shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-display font-bold text-foreground">{client.name}</h1>
                <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border", statusCfg.bg, statusCfg.color, statusCfg.border)}>
                  {statusCfg.label}
                </span>
                <span className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold", riskCfg.bg, riskCfg.color)}>
                  {riskCfg.label} ({client.riskScore}/100)
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {client.cedula && <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {client.cedula}</span>}
                {client.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {client.phone}</span>}
                {client.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {client.address}</span>}
              </div>
              {client.notes && (
                <p className="mt-2 text-sm text-muted-foreground italic">📝 {client.notes}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap shrink-0">
            <button
              onClick={() => setShowStatusPanel(!showStatusPanel)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-white/5 text-sm font-medium transition-all"
            >
              <SlidersHorizontal className="w-4 h-4" /> Gestionar
            </button>
            <Link href={`/loans/new?clientId=${client.id}`} className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] flex items-center gap-2 text-sm whitespace-nowrap">
              <Plus className="w-4 h-4" /> Nuevo Préstamo
            </Link>
          </div>
        </div>

        {showStatusPanel && (
          <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Estado del Cliente</p>
              <div className="flex gap-2 flex-wrap">
                {(["active", "delinquent", "uncollectible"] as const).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const isActive = client.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={isActive || updateMutation.isPending}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-50",
                        isActive
                          ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {isActive ? "✓ " : ""}{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Score de Riesgo (0 = bajo, 100 = alto)</p>
              <div className="flex gap-3 items-center">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={newRisk ?? client.riskScore}
                  onChange={(e) => setNewRisk(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className={cn("text-lg font-bold font-display w-12 text-center", RISK_CONFIG(newRisk ?? client.riskScore).color)}>
                  {newRisk ?? client.riskScore}
                </span>
                <button
                  onClick={handleRiskChange}
                  disabled={newRisk === null || updateMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-xl font-display font-bold mb-5 flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-primary" /> Historial de Préstamos
        <span className="text-sm font-normal text-muted-foreground">({client.loans.length})</span>
      </h2>

      {client.loans.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border border-dashed rounded-3xl">
          <p className="text-muted-foreground mb-4">Este cliente no tiene préstamos registrados.</p>
          <Link href="/loans/new" className="text-primary font-bold hover:underline">Registrar el primer préstamo</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {client.loans.map(loan => {
            const paidCount = loan.installments.filter(i => i.status === "paid").length;
            const lateCount = loan.installments.filter(i => i.status !== "paid" && i.dueDate < today).length;
            const progress = (paidCount / loan.installmentsCount) * 100;
            const isCompleted = progress === 100;

            return (
              <div key={loan.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
                <div className="p-5 border-b border-border bg-secondary/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-xl font-display font-bold">{formatRD(loan.amount)}</h3>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${isCompleted ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/20 text-primary"}`}>
                        {isCompleted ? "Completado" : "Activo"}
                      </span>
                      {lateCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-amber-500/20 text-amber-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {lateCount} atrasada(s)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Interés: {loan.interestRate}% · Total: {formatRD(loan.totalAmount)} · {loan.frequency}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground"><Calendar className="w-4 h-4 inline mr-1" />Inicio: {formatDate(loan.startDate)}</p>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span>{paidCount} de {loan.installmentsCount} cuotas pagadas</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5 mb-5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${isCompleted ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                    {loan.installments.map((inst, i) => {
                      const isLate = inst.status !== "paid" && inst.dueDate < today;
                      return (
                        <div key={inst.id} className={cn(
                          "p-2.5 rounded-xl border text-center relative overflow-hidden",
                          inst.status === "paid" ? "border-emerald-500/30 bg-emerald-500/5" :
                          isLate ? "border-amber-500/50 bg-amber-500/10" :
                          "border-border bg-background"
                        )}>
                          <p className="text-[10px] text-muted-foreground mb-0.5">#{i + 1}</p>
                          <p className={cn("text-xs font-bold font-display", inst.status === "paid" ? "text-emerald-500" : isLate ? "text-amber-500" : "text-foreground")}>
                            {formatRD(inst.amount)}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{formatDate(inst.dueDate)}</p>
                          {inst.status === "paid" && <CheckCircle2 className="w-3 h-3 text-emerald-500 absolute top-1 right-1 opacity-60" />}
                          {isLate && <Clock className="w-3 h-3 text-amber-500 absolute top-1 right-1 opacity-60" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
