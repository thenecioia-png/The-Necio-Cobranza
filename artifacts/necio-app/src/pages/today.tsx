import { useState } from "react";
import { useGetTodayInstallments, usePayInstallment, getGetTodayInstallmentsQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatRD, cn } from "@/lib/utils";
import { CheckCircle2, User, Phone, MapPin, Receipt, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function TodayInstallments() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: installments, isLoading } = useGetTodayInstallments();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const payMutation = usePayInstallment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({
          title: "Cobro registrado",
          description: "La cuota ha sido marcada como pagada exitosamente.",
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo registrar el pago.",
        });
      }
    }
  });

  const handlePay = (id: number) => {
    payMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="h-10 bg-card rounded w-1/4 mb-8"></div>
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-card rounded-2xl animate-pulse"></div>)}
      </div>
    );
  }

  const filtered = installments?.filter(inst => 
    inst.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Sort: pending first
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  const pendingCount = sorted.filter(i => i.status === 'pending').length;
  const totalAmount = sorted.reduce((sum, i) => i.status === 'pending' ? sum + i.amount : sum, 0);

  return (
    <div className="p-8 lg:p-12 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Ruta de Hoy</h1>
          <p className="text-muted-foreground mt-1">
            <span className="text-primary font-bold">{pendingCount}</span> cuotas pendientes por un total de <span className="font-bold text-foreground">{formatRD(totalAmount)}</span>
          </p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar cliente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-display font-bold text-foreground">¡Todo al día!</h3>
          <p className="text-muted-foreground">No hay cuotas pendientes para cobrar hoy.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {sorted.map((inst, idx) => {
              const isPaid = inst.status === 'paid';
              return (
                <motion.div
                  key={inst.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "bg-card border rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all duration-500",
                    isPaid ? "border-emerald-500/20 opacity-60 bg-emerald-950/10" : "border-border shadow-lg hover:border-primary/50"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={cn("text-xl font-bold font-display tracking-wide", isPaid && "line-through text-muted-foreground")}>
                        {inst.clientName}
                      </h3>
                      {isPaid && (
                        <span className="bg-emerald-500/20 text-emerald-500 text-xs px-2 py-1 rounded-md font-bold uppercase tracking-wider">Pagado</span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {inst.clientPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-4 h-4" /> {inst.clientPhone}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-4 h-4" /> Frecuencia: {inst.loanFrequency}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center w-full md:w-auto justify-between md:justify-end gap-6 border-t md:border-t-0 border-border/50 pt-4 md:pt-0">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monto a Cobrar</p>
                      <p className={cn("text-2xl font-display font-bold", isPaid ? "text-muted-foreground" : "text-foreground")}>
                        {formatRD(inst.amount)}
                      </p>
                    </div>

                    {!isPaid ? (
                      <button
                        onClick={() => handlePay(inst.id)}
                        disabled={payMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-[0_0_15px_rgba(5,150,105,0.3)] hover:shadow-[0_0_25px_rgba(5,150,105,0.5)] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Cobrar
                      </button>
                    ) : (
                      <div className="w-32 flex justify-end">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
