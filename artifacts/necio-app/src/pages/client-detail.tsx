import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetClient, useUpdateClient, getGetClientQueryKey, getGetClientsQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatRD, formatDate, cn } from "@/lib/utils";
import { User, Phone, MapPin, CreditCard, Calendar, Plus, ArrowLeft, CheckCircle2, Clock, AlertTriangle, Shield, SlidersHorizontal, MessageCircle, UserCog, Loader2, Banknote, X, TrendingDown, Zap } from "lucide-react";
import { ClientAvatarUpload } from "@/components/client-avatar";

const API_BASE = "/api";

interface Cobrador { id: number; name: string; username: string; }
const fetchCobradores = (): Promise<Cobrador[]> =>
  fetch("/api/cobradores", { credentials: "include" }).then(r => r.ok ? r.json() : []);

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
  const [assigningCobrador, setAssigningCobrador] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Abono modal state
  const [abonoLoanId, setAbonoLoanId] = useState<number | null>(null);
  const [abonoAmount, setAbonoAmount] = useState("");
  const [abonoMethod, setAbonoMethod] = useState<"efectivo" | "transferencia" | "otro">("efectivo");
  const [abonoLoading, setAbonoLoading] = useState(false);

  // Liquidar modal state
  const [liquidarLoan, setLiquidarLoan] = useState<null | { id: number; totalAmount: number; pendingAmount: number; pendingCount: number }>(null);
  const [liquidarMethod, setLiquidarMethod] = useState<"efectivo" | "transferencia" | "otro">("efectivo");
  const [liquidarLoading, setLiquidarLoading] = useState(false);

  const { data: client, isLoading, isError } = useGetClient(id);
  const { data: cobradores = [] } = useQuery({ queryKey: ["cobradores"], queryFn: fetchCobradores, staleTime: 60_000 });

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

  const handleAvatarChange = async (file: File) => {
    const reader = new FileReader();
    reader.onload = e => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setAvatarUploading(true);
    try {
      const urlRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Error al obtener URL");
      const { uploadURL, objectPath } = await urlRes.json();
      const upRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!upRes.ok) throw new Error("Error al subir imagen");

      const patchRes = await fetch(`${API_BASE}/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarUrl: objectPath }),
      });
      if (!patchRes.ok) throw new Error("Error al guardar foto");

      queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey() });
      toast({ title: "Foto actualizada", description: "La foto de perfil se guardó correctamente." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo subir la foto." });
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCobradorAssign = async (cobradorId: number | null) => {
    setAssigningCobrador(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cobradorId }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey() });
      const name = cobradores.find(c => c.id === cobradorId)?.name;
      toast({ title: "Cobrador asignado", description: cobradorId ? `${name} cobrará a este cliente.` : "Cliente sin cobrador asignado." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo asignar el cobrador." });
    } finally {
      setAssigningCobrador(false);
    }
  };

  const handleAbono = async () => {
    if (!abonoLoanId || !abonoAmount || Number(abonoAmount) <= 0) return;
    setAbonoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/installments/abono-loan/${abonoLoanId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: Number(abonoAmount), paymentMethod: abonoMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast({
        title: data.loanCompleted ? "¡Préstamo Liquidado! 🎉" : `Abono registrado`,
        description: data.loanCompleted
          ? `Se pagaron ${data.paid} cuotas restantes. Préstamo completado.`
          : `Se cubrieron ${data.paid} cuota(s) · ${formatRD(data.amountApplied)} aplicados`,
      });
      setAbonoLoanId(null);
      setAbonoAmount("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo registrar el abono" });
    } finally {
      setAbonoLoading(false);
    }
  };

  const handleLiquidar = async () => {
    if (!liquidarLoan) return;
    setLiquidarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/installments/loan/${liquidarLoan.id}/liquidar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentMethod: liquidarMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast({ title: "¡Préstamo Liquidado! 🎉", description: `${data.paid} cuotas pagadas · ${formatRD(data.totalAmount)} total` });
      setLiquidarLoan(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo liquidar el préstamo" });
    } finally {
      setLiquidarLoading(false);
    }
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
          <div className="flex gap-5 items-start">
            <div className="flex flex-col items-center gap-1">
              <ClientAvatarUpload
                name={client.name}
                avatarUrl={(client as any).avatarUrl}
                previewUrl={avatarPreview}
                onFileSelected={handleAvatarChange}
                uploading={avatarUploading}
              />
              <span className="text-[10px] text-muted-foreground">Toca para cambiar</span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-display font-bold text-foreground">{client.name}</h1>
                {client.apodo && <span className="text-muted-foreground text-base">"{client.apodo}"</span>}
                <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border", statusCfg.bg, statusCfg.color, statusCfg.border)}>
                  {statusCfg.label}
                </span>
                <span className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold", riskCfg.bg, riskCfg.color)}>
                  {riskCfg.label} ({client.riskScore}/100)
                </span>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 text-sm text-muted-foreground">
                {client.cedula && <span className="flex items-center gap-1.5"><User className="w-4 h-4 shrink-0" /> {client.cedula}</span>}
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Phone className="w-4 h-4 shrink-0" /> {client.phone}
                  </a>
                )}
                {client.whatsapp && (
                  <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors">
                    <MessageCircle className="w-4 h-4 shrink-0" /> {client.whatsapp}
                  </a>
                )}
                {(client.sector || client.ciudad || client.address) && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([client.address, client.sector, client.ciudad].filter(Boolean).join(", "))}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-blue-400 transition-colors"
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    {[client.address, client.sector, client.ciudad].filter(Boolean).join(", ")}
                  </a>
                )}
              </div>
              {client.notes && (
                <p className="mt-2 text-sm text-muted-foreground italic">📝 {client.notes}</p>
              )}
              {(client.fiadorName || client.fiadorPhone) && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Fiador: <span className="text-foreground font-medium">{client.fiadorName}</span>
                  {client.fiadorPhone && <> · <a href={`tel:${client.fiadorPhone}`} className="hover:text-primary transition-colors">{client.fiadorPhone}</a></>}</span>
                </div>
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
          <div className="mt-6 pt-6 border-t border-border/50 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            {/* Cobrador Assignment */}
            <div className="pt-5 border-t border-border/40">
              <div className="flex items-center gap-2 mb-3">
                <UserCog className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cobrador Asignado</p>
              </div>
              {cobradores.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No hay cobradores registrados. Ve a <Link href="/cobradores" className="text-primary hover:underline">Cobradores</Link> para crear uno.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleCobradorAssign(null)}
                    disabled={assigningCobrador || !(client as any).cobradorId}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50",
                      !(client as any).cobradorId
                        ? "bg-border/30 border-border text-foreground"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    Sin asignar
                  </button>
                  {cobradores.map(cob => {
                    const isAssigned = (client as any).cobradorId === cob.id;
                    return (
                      <button
                        key={cob.id}
                        onClick={() => handleCobradorAssign(cob.id)}
                        disabled={assigningCobrador || isAssigned}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50",
                          isAssigned
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {assigningCobrador && isAssigned ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {isAssigned ? "✓ " : ""}{cob.name}
                      </button>
                    );
                  })}
                </div>
              )}
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
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm text-muted-foreground"><Calendar className="w-4 h-4 inline mr-1" />Inicio: {formatDate(loan.startDate)}</p>
                    {!isCompleted && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setAbonoLoanId(loan.id);
                            setAbonoAmount("");
                            setAbonoMethod("efectivo");
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold transition-all"
                        >
                          <Banknote className="w-3.5 h-3.5" /> Abonar
                        </button>
                        <button
                          onClick={() => {
                            const pendingInsts = loan.installments.filter(i => i.status !== "paid");
                            const pendingAmount = pendingInsts.reduce((s, i) => s + Number(i.amount), 0);
                            setLiquidarLoan({ id: loan.id, totalAmount: Number(loan.totalAmount), pendingAmount, pendingCount: pendingInsts.length });
                            setLiquidarMethod("efectivo");
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all"
                        >
                          <Zap className="w-3.5 h-3.5" /> Liquidar
                        </button>
                      </div>
                    )}
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
      {/* ---- ABONO MODAL ---- */}
      {abonoLoanId !== null && (() => {
        const loan = client.loans.find(l => l.id === abonoLoanId);
        if (!loan) return null;
        const pending = loan.installments
          .filter(i => i.status !== "paid")
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const pendingTotal = pending.reduce((s, i) => s + Number(i.amount), 0);
        const enteredAmount = Number(abonoAmount) || 0;

        // Preview: simulate cascade
        let sim = enteredAmount;
        let wouldPay = 0;
        let leftover = 0;
        for (const inst of pending) {
          const a = Number(inst.amount);
          if (sim >= a) { wouldPay++; sim -= a; } else break;
        }
        leftover = sim;

        const METHODS = [
          { value: "efectivo", label: "💵 Efectivo" },
          { value: "transferencia", label: "🏦 Transferencia" },
          { value: "otro", label: "📋 Otro" },
        ] as const;

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setAbonoLoanId(null)}>
            <div className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/15">
                    <Banknote className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold">Abono / Pago Anticipado</h3>
                    <p className="text-xs text-muted-foreground">{pending.length} cuota(s) pendientes · {formatRD(pendingTotal)}</p>
                  </div>
                </div>
                <button onClick={() => setAbonoLoanId(null)} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Amount input */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Monto a abonar</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">RD$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={abonoAmount}
                      onChange={e => setAbonoAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-background border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-lg font-bold font-display focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                      autoFocus
                    />
                  </div>
                  {/* Quick amount buttons */}
                  {pending.length > 0 && (
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      {[1, 2, 3].filter(n => n <= pending.length).map(n => {
                        const amt = pending.slice(0, n).reduce((s, i) => s + Number(i.amount), 0);
                        return (
                          <button key={n} onClick={() => setAbonoAmount(String(amt))}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all">
                            {n} cuota{n > 1 ? "s" : ""} · {formatRD(amt)}
                          </button>
                        );
                      })}
                      <button onClick={() => setAbonoAmount(String(pendingTotal))}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all">
                        Todo · {formatRD(pendingTotal)}
                      </button>
                    </div>
                  )}
                </div>

                {/* Live preview */}
                {enteredAmount > 0 && (
                  <div className={cn(
                    "rounded-2xl border p-4 text-sm space-y-1.5",
                    wouldPay > 0 ? "bg-blue-500/5 border-blue-500/20" : "bg-destructive/5 border-destructive/20"
                  )}>
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-blue-400" /> Vista previa
                    </p>
                    {wouldPay > 0 ? (
                      <>
                        <p className="text-muted-foreground">✅ Cubrirá <span className="text-white font-bold">{wouldPay} cuota{wouldPay > 1 ? "s" : ""}</span> (del {formatDate(pending[0].dueDate)} al {formatDate(pending[wouldPay - 1].dueDate)})</p>
                        {leftover > 0 && <p className="text-amber-400 text-xs">⚠️ Sobrante {formatRD(leftover)} no se aplica a cuotas parciales</p>}
                        {wouldPay === pending.length && <p className="text-emerald-400 font-bold">🎉 ¡Se liquidará el préstamo completo!</p>}
                      </>
                    ) : (
                      <p className="text-destructive">El monto no alcanza para cubrir ni una cuota ({formatRD(Number(pending[0]?.amount))})</p>
                    )}
                  </div>
                )}

                {/* Payment method */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Método de pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {METHODS.map(m => (
                      <button key={m.value} onClick={() => setAbonoMethod(m.value)}
                        className={cn("py-2.5 rounded-xl border text-xs font-bold transition-all",
                          abonoMethod === m.value
                            ? "bg-blue-500/20 border-blue-500 text-blue-300"
                            : "bg-background border-border text-muted-foreground hover:border-blue-500/40"
                        )}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAbono}
                  disabled={abonoLoading || !abonoAmount || Number(abonoAmount) <= 0 || wouldPay === 0}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {abonoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5" />}
                  {abonoLoading ? "Registrando..." : `Registrar Abono · ${enteredAmount > 0 ? formatRD(enteredAmount - leftover) : "RD$0"}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---- LIQUIDAR MODAL ---- */}
      {liquidarLoan && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setLiquidarLoan(null)}>
          <div className="bg-card border border-emerald-500/30 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold">Liquidar Préstamo</h3>
                  <p className="text-xs text-muted-foreground">Pagar todas las cuotas restantes de una vez</p>
                </div>
              </div>
              <button onClick={() => setLiquidarLoan(null)} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 text-center">
                <p className="text-sm text-muted-foreground mb-1">{liquidarLoan.pendingCount} cuotas pendientes</p>
                <p className="text-4xl font-display font-bold text-emerald-400">{formatRD(liquidarLoan.pendingAmount)}</p>
                <p className="text-xs text-muted-foreground mt-2">Monto total a pagar para liquidar</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "efectivo", label: "💵 Efectivo" },
                    { value: "transferencia", label: "🏦 Transferencia" },
                    { value: "otro", label: "📋 Otro" },
                  ].map((m) => (
                    <button key={m.value} onClick={() => setLiquidarMethod(m.value as any)}
                      className={cn("py-2.5 rounded-xl border text-xs font-bold transition-all",
                        liquidarMethod === m.value
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-background border-border text-muted-foreground hover:border-emerald-500/40"
                      )}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setLiquidarLoan(null)}
                  className="flex-1 py-3 rounded-xl border border-border text-muted-foreground hover:bg-white/5 font-semibold text-sm transition-all">
                  Cancelar
                </button>
                <button onClick={handleLiquidar} disabled={liquidarLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {liquidarLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  {liquidarLoading ? "Procesando..." : "¡Liquidar Ahora!"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
