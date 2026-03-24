import { useState } from "react";
import { useGetTodayInstallments, usePayInstallment, getGetTodayInstallmentsQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatRD, cn } from "@/lib/utils";
import { CheckCircle2, Phone, Receipt, Search, CheckSquare, Square, Banknote, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

export default function TodayInstallments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [abonoModal, setAbonoModal] = useState<{ clientId: number; clientName: string } | null>(null);
  const [abonoAmount, setAbonoAmount] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [abonoLoading, setAbonoLoading] = useState(false);

  const { data: installments, isLoading } = useGetTodayInstallments();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const payMutation = usePayInstallment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "¡Cobrado!", description: "Cuota marcada como pagada." });
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el pago." });
      }
    }
  });

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectMode = () => {
    setSelectMode(v => !v);
    setSelected(new Set());
  };

  const selectAll = () => {
    const pendingIds = sorted.filter(i => i.status === "pending").map(i => i.id);
    setSelected(new Set(pendingIds));
  };

  const handleBulkPay = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`${API_BASE}/installments/pay-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installmentIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: getGetTodayInstallmentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast({
        title: `¡${data.paid} cuota(s) cobrada(s)!`,
        description: `Se registró un total de ${formatRD(data.totalAmount)}.`,
      });
      setSelected(new Set());
      setSelectMode(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo procesar." });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleAbono = async () => {
    if (!abonoModal || !abonoAmount) return;
    const amount = parseFloat(abonoAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Monto inválido", description: "Ingresa un monto mayor a cero." });
      return;
    }
    setAbonoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/installments/abono/${abonoModal.clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: getGetTodayInstallmentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });

      let desc = `Se aplicaron ${formatRD(data.amountApplied)} y se pagaron ${data.paid} cuota(s).`;
      if (data.amountRemaining > 0) {
        desc += ` Sobraron ${formatRD(data.amountRemaining)} (no alcanzó para la próxima cuota).`;
      }
      toast({ title: "Abono registrado", description: desc });
      setAbonoModal(null);
      setAbonoAmount("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo aplicar el abono." });
    } finally {
      setAbonoLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="h-10 bg-card rounded w-1/4 mb-8 animate-pulse"></div>
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-card rounded-2xl animate-pulse"></div>)}
      </div>
    );
  }

  const filtered = installments?.filter(inst =>
    inst.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });

  const pendingList = sorted.filter(i => i.status === "pending");
  const pendingCount = pendingList.length;
  const totalPending = pendingList.reduce((s, i) => s + i.amount, 0);
  const selectedItems = sorted.filter(i => selected.has(i.id));
  const selectedTotal = selectedItems.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Ruta de Hoy</h1>
          <p className="text-muted-foreground mt-1">
            <span className="text-primary font-bold">{pendingCount}</span> pendiente(s) · <span className="font-bold text-foreground">{formatRD(totalPending)}</span>
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 bg-card border border-border rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {pendingCount > 0 && (
            <button
              onClick={toggleSelectMode}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                selectMode
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <CheckSquare className="w-4 h-4" />
              {selectMode ? "Cancelar" : "Seleccionar"}
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 bg-card border border-primary/30 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <button onClick={selectAll} className="text-sm text-primary font-semibold hover:underline">
                Seleccionar todo ({pendingCount})
              </button>
              {selected.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selected.size} seleccionada(s) · <span className="font-bold text-foreground">{formatRD(selectedTotal)}</span>
                </span>
              )}
            </div>
            <button
              onClick={handleBulkPay}
              disabled={selected.size === 0 || bulkLoading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md"
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Cobrar {selected.size > 0 ? `${selected.size} cuota(s)` : "seleccionadas"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {sorted.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-display font-bold">¡Todo al día!</h3>
          <p className="text-muted-foreground">No hay cuotas pendientes para cobrar hoy.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {sorted.map((inst, idx) => {
              const isPaid = inst.status === "paid";
              const isSelected = selected.has(inst.id);
              const clientId = (inst as any).clientId as number;

              return (
                <motion.div
                  key={inst.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  className={cn(
                    "bg-card border rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300",
                    isPaid ? "border-emerald-500/20 opacity-60 bg-emerald-950/10" :
                    isSelected ? "border-primary shadow-[0_0_0_2px_rgba(225,29,72,0.3)]" :
                    "border-border shadow-md hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Checkbox (select mode only, pending only) */}
                    {selectMode && !isPaid && (
                      <button
                        onClick={() => toggleSelect(inst.id)}
                        className="shrink-0 text-primary"
                      >
                        {isSelected
                          ? <CheckSquare className="w-6 h-6" />
                          : <Square className="w-6 h-6 text-muted-foreground" />}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className={cn("text-lg font-bold font-display", isPaid && "line-through text-muted-foreground")}>
                          {inst.clientName}
                        </h3>
                        {isPaid && (
                          <span className="bg-emerald-500/20 text-emerald-500 text-xs px-2 py-0.5 rounded font-bold uppercase">Pagado</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {inst.clientPhone && (
                          <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {inst.clientPhone}</span>
                        )}
                        <span className="flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> {inst.loanFrequency}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center w-full md:w-auto justify-between md:justify-end gap-3 border-t md:border-t-0 border-border/40 pt-3 md:pt-0">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Cuota</p>
                      <p className={cn("text-2xl font-display font-bold", isPaid ? "text-muted-foreground" : "text-foreground")}>
                        {formatRD(inst.amount)}
                      </p>
                    </div>

                    {!isPaid && !selectMode && (
                      <div className="flex gap-2">
                        {/* Abono button */}
                        <button
                          onClick={() => {
                            setAbonoModal({ clientId, clientName: inst.clientName });
                            setAbonoAmount("");
                          }}
                          className="flex items-center gap-1.5 border border-border bg-background hover:bg-white/5 text-foreground font-semibold px-4 py-2.5 rounded-xl transition-all text-sm"
                        >
                          <Banknote className="w-4 h-4" /> Abono
                        </button>

                        {/* Pay full button */}
                        <button
                          onClick={() => payMutation.mutate({ id: inst.id })}
                          disabled={payMutation.isPending}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-[0_0_12px_rgba(5,150,105,0.25)] hover:shadow-[0_0_20px_rgba(5,150,105,0.45)] transition-all active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Cobrar
                        </button>
                      </div>
                    )}

                    {!isPaid && selectMode && (
                      <button
                        onClick={() => toggleSelect(inst.id)}
                        className={cn(
                          "px-5 py-2.5 rounded-xl font-bold text-sm transition-all border",
                          isSelected
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {isSelected ? "Seleccionada ✓" : "Seleccionar"}
                      </button>
                    )}

                    {isPaid && (
                      <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Abono Modal */}
      <AnimatePresence>
        {abonoModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setAbonoModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-auto px-4"
            >
              <div className="bg-card border border-border rounded-3xl p-7 shadow-2xl">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-display font-bold">Registrar Abono</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Cliente: <span className="font-semibold text-foreground">{abonoModal.clientName}</span>
                    </p>
                  </div>
                  <button onClick={() => setAbonoModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Monto del Abono (RD$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="Ej: 1500.00"
                    value={abonoAmount}
                    onChange={e => setAbonoAmount(e.target.value)}
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && handleAbono()}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-2xl font-display focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>

                <p className="text-xs text-muted-foreground mb-6 mt-2">
                  El sistema aplicará el monto a las cuotas pendientes más antiguas, de mayor a menor antigüedad.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setAbonoModal(null)}
                    className="flex-1 bg-background border border-border rounded-xl py-3 font-semibold text-muted-foreground hover:text-foreground transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAbono}
                    disabled={!abonoAmount || abonoLoading}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl py-3 font-bold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {abonoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5" />}
                    Aplicar Abono
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
