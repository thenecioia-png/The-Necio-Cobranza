import { useState } from "react";
import { useGetTodayInstallments, getGetTodayInstallmentsQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatRD, cn } from "@/lib/utils";
import { CheckCircle2, Phone, Receipt, Search, CheckSquare, Square, Banknote, X, Loader2, Navigation, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo", emoji: "💵" },
  { value: "transferencia", label: "Transferencia", emoji: "🏦" },
  { value: "otro", label: "Otro", emoji: "📋" },
] as const;

type PaymentMethod = "efectivo" | "transferencia" | "otro";

export default function TodayInstallments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState<Record<number, PaymentMethod>>({});
  const [singleLoading, setSingleLoading] = useState<number | null>(null);
  const [abonoModal, setAbonoModal] = useState<{ clientId: number; clientName: string } | null>(null);
  const [abonoAmount, setAbonoAmount] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [abonoLoading, setAbonoLoading] = useState(false);

  const { data: installments, isLoading } = useGetTodayInstallments();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayInstallmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
  };

  const handlePay = async (id: number) => {
    const method = payMethod[id] || "efectivo";
    setSingleLoading(id);
    try {
      const res = await fetch(`${API_BASE}/installments/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method }),
      });
      if (!res.ok) throw new Error();
      invalidateAll();
      setPayingId(null);
      const methodLabel = PAYMENT_METHODS.find(m => m.value === method)?.label ?? method;
      toast({ title: "¡Cobrado!", description: `Pago registrado como ${methodLabel}.` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el pago." });
    } finally {
      setSingleLoading(null);
    }
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
      invalidateAll();
      toast({ title: `¡${data.paid} cuota(s) cobrada(s)!`, description: `Total: ${formatRD(data.totalAmount)}` });
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
      invalidateAll();
      let desc = `${formatRD(data.amountApplied)} aplicados — ${data.paid} cuota(s) pagada(s).`;
      if (data.amountRemaining > 0) desc += ` Sobraron ${formatRD(data.amountRemaining)}.`;
      toast({ title: "Abono registrado", description: desc });
      setAbonoModal(null);
      setAbonoAmount("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo aplicar." });
    } finally {
      setAbonoLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="h-10 bg-card rounded w-1/4 mb-8 animate-pulse" />
        {[1, 2, 3].map(i => <div key={i} className="h-36 bg-card rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  const filtered = installments?.filter(i =>
    i.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });

  const pendingList = sorted.filter(i => i.status === "pending");
  const pendingCount = pendingList.length;
  const totalPending = pendingList.reduce((s, i) => s + i.amount, 0);
  const selectedTotal = sorted.filter(i => selected.has(i.id)).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Ruta de Hoy</h1>
          <p className="text-muted-foreground mt-1">
            <span className="text-primary font-bold">{pendingCount}</span> pendiente(s) ·{" "}
            <span className="font-bold text-foreground">{formatRD(totalPending)}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-48 bg-card border border-border rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          {pendingCount > 0 && (
            <button
              onClick={() => { setSelectMode(v => !v); setSelected(new Set()); setPayingId(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                selectMode ? "bg-primary/20 border-primary/50 text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
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
              <button
                onClick={() => setSelected(new Set(pendingList.map(i => i.id)))}
                className="text-sm text-primary font-semibold hover:underline"
              >
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
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-6 py-2.5 rounded-xl transition-all"
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
              const isPaying = payingId === inst.id;
              const clientId = (inst as any).clientId as number;
              const clientAddress = (inst as any).clientAddress as string | undefined;
              const clientSector = (inst as any).clientSector as string | undefined;
              const clientCiudad = (inst as any).clientCiudad as string | undefined;
              const mapsQuery = [clientAddress, clientSector, clientCiudad].filter(Boolean).join(", ");
              const selectedMethod = payMethod[inst.id] || "efectivo";

              return (
                <motion.div
                  key={inst.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  className={cn(
                    "bg-card border rounded-2xl overflow-hidden transition-all duration-300 shadow-md",
                    isPaid ? "border-emerald-500/20 opacity-60" :
                    isSelected ? "border-primary shadow-[0_0_0_2px_rgba(225,29,72,0.25)]" :
                    "border-border hover:border-primary/40"
                  )}
                >
                  {/* Main row */}
                  <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {selectMode && !isPaid && (
                        <button onClick={() => toggleSelect(inst.id)} className="shrink-0 text-primary">
                          {isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6 text-muted-foreground" />}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className={cn("text-lg font-bold font-display", isPaid && "line-through text-muted-foreground")}>
                            {inst.clientName}
                          </h3>
                          {isPaid && (
                            <span className="bg-emerald-500/20 text-emerald-500 text-xs px-2 py-0.5 rounded font-bold uppercase">
                              Pagado · {(inst as any).paymentMethod === "transferencia" ? "🏦 Transferencia" : (inst as any).paymentMethod === "otro" ? "📋 Otro" : "💵 Efectivo"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          {inst.clientPhone && (
                            <a href={`tel:${inst.clientPhone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                              <Phone className="w-3.5 h-3.5" /> {inst.clientPhone}
                            </a>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5" /> {inst.loanFrequency}
                          </span>
                          {mapsQuery && (
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(mapsQuery)}`}
                              target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 hover:text-blue-400 transition-colors"
                              title="Abrir en Google Maps"
                            >
                              <Navigation className="w-3.5 h-3.5" /> Cómo llegar
                            </a>
                          )}
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
                          <button
                            onClick={() => { setAbonoModal({ clientId, clientName: inst.clientName }); setAbonoAmount(""); }}
                            className="border border-border bg-background hover:bg-white/5 text-sm font-semibold px-3 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                          >
                            <Banknote className="w-4 h-4" /> Abono
                          </button>
                          <button
                            onClick={() => setPayingId(isPaying ? null : inst.id)}
                            className={cn(
                              "font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 text-sm",
                              isPaying
                                ? "bg-primary/20 border border-primary text-primary"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(5,150,105,0.25)]"
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {isPaying ? "Cancelar" : "Cobrar"}
                          </button>
                        </div>
                      )}

                      {!isPaid && selectMode && (
                        <button
                          onClick={() => toggleSelect(inst.id)}
                          className={cn(
                            "px-5 py-2.5 rounded-xl font-bold text-sm transition-all border",
                            isSelected ? "bg-primary/20 border-primary text-primary" : "bg-background border-border text-muted-foreground"
                          )}
                        >
                          {isSelected ? "✓ Seleccionada" : "Seleccionar"}
                        </button>
                      )}

                      {isPaid && <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />}
                    </div>
                  </div>

                  {/* Payment method panel (only when clicking Cobrar) */}
                  <AnimatePresence>
                    {isPaying && !isPaid && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border/60 overflow-hidden"
                      >
                        <div className="px-5 py-4 bg-secondary/20">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Método de Pago</p>
                          <div className="flex gap-2 flex-wrap mb-4">
                            {PAYMENT_METHODS.map(m => (
                              <button
                                key={m.value}
                                onClick={() => setPayMethod(prev => ({ ...prev, [inst.id]: m.value }))}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
                                  selectedMethod === m.value
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                )}
                              >
                                <span>{m.emoji}</span> {m.label}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => handlePay(inst.id)}
                            disabled={singleLoading === inst.id}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(5,150,105,0.3)] transition-all disabled:opacity-50"
                          >
                            {singleLoading === inst.id
                              ? <Loader2 className="w-5 h-5 animate-spin" />
                              : <CheckCircle2 className="w-5 h-5" />}
                            Confirmar Cobro · {formatRD(inst.amount)} ({PAYMENT_METHODS.find(m => m.value === selectedMethod)?.emoji})
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setAbonoModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
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
                  <button onClick={() => setAbonoModal(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

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
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-2xl font-display focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mb-2"
                />
                <p className="text-xs text-muted-foreground mb-6">
                  Se aplica a las cuotas más antiguas primero. Si no alcanza para una cuota completa, el resto se nota.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setAbonoModal(null)}
                    className="flex-1 bg-background border border-border rounded-xl py-3 font-semibold text-muted-foreground hover:text-foreground"
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
