import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateLoan, useGetClients, getGetClientQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CreditCard, Loader2, User } from "lucide-react";
import { motion } from "framer-motion";
import { formatRD } from "@/lib/utils";

const formSchema = z.object({
  clientId: z.coerce.number().min(1, "Debe seleccionar un cliente"),
  amount: z.coerce.number().min(100, "El monto debe ser mayor a 100"),
  interestRate: z.coerce.number().min(0, "La tasa de interés no puede ser negativa"),
  installmentsCount: z.coerce.number().min(1, "Debe tener al menos 1 cuota"),
  startDate: z.string().min(1, "Debe seleccionar una fecha de inicio"),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoanCreate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const preselectedClientId = parseInt(
    new URLSearchParams(window.location.search).get("clientId") || "0",
    10
  );

  const { data: clients, isLoading: clientsLoading } = useGetClients();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: preselectedClientId || 0,
      amount: 1000,
      interestRate: 20,
      installmentsCount: 30,
      startDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' }),
      frequency: "daily"
    }
  });

  const watchAmount = Number(watch("amount")) || 0;
  const watchInterest = Number(watch("interestRate")) || 0;
  const watchCount = Number(watch("installmentsCount")) || 1;

  const totalAmount = watchAmount + (watchAmount * (watchInterest / 100));
  const installmentAmount = watchCount > 0 ? totalAmount / watchCount : 0;

  const preselectedClient = clients?.find(c => c.id === preselectedClientId);

  const createMutation = useCreateLoan({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(data.clientId) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "Préstamo creado exitosamente" });
        setLocation(`/clients/${data.clientId}`);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo crear el préstamo" });
      }
    }
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({ data });
  };

  return (
    <div className="p-8 lg:p-12 max-w-4xl mx-auto">
      <div className="mb-8">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-8 shadow-xl"
      >
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/50">
          <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Nuevo Préstamo</h1>
            <p className="text-muted-foreground text-sm">Configure los términos y generará las cuotas automáticamente.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cliente *</label>

              {preselectedClient ? (
                <>
                  <div className="flex items-center gap-3 w-full bg-background border border-primary/40 rounded-xl px-4 py-3">
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold text-foreground">
                      {preselectedClient.name}
                      {preselectedClient.cedula ? <span className="text-muted-foreground font-normal ml-2 text-sm">— {preselectedClient.cedula}</span> : null}
                    </span>
                  </div>
                  <input type="hidden" {...register("clientId")} value={preselectedClientId} />
                </>
              ) : (
                <select
                  {...register("clientId")}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                  disabled={clientsLoading}
                >
                  <option value="0">Seleccione un cliente...</option>
                  {clients?.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.cedula ? `- ${c.cedula}` : ''}</option>
                  ))}
                </select>
              )}

              {errors.clientId && <p className="text-destructive text-sm mt-1">{errors.clientId.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Monto (RD$) *</label>
              <input
                type="number"
                step="0.01"
                {...register("amount")}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-display text-xl"
              />
              {errors.amount && <p className="text-destructive text-sm mt-1">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tasa de Interés (%) *</label>
              <input
                type="number"
                step="0.1"
                {...register("interestRate")}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-display text-xl"
              />
              {errors.interestRate && <p className="text-destructive text-sm mt-1">{errors.interestRate.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cantidad de Cuotas *</label>
              <input
                type="number"
                {...register("installmentsCount")}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-display text-xl"
              />
              {errors.installmentsCount && <p className="text-destructive text-sm mt-1">{errors.installmentsCount.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Frecuencia *</label>
              <select
                {...register("frequency")}
                className="w-full bg-background border border-border rounded-xl px-4 py-3.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Fecha de Inicio *</label>
              <input
                type="date"
                {...register("startDate")}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              {errors.startDate && <p className="text-destructive text-sm mt-1">{errors.startDate.message}</p>}
            </div>
          </div>

          <div className="mt-8 bg-secondary/30 rounded-2xl p-6 border border-border flex flex-col md:flex-row justify-around gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monto Total a Pagar</p>
              <p className="text-3xl font-display font-bold text-primary">{formatRD(totalAmount)}</p>
            </div>
            <div className="hidden md:block w-px bg-border"></div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Valor de la Cuota</p>
              <p className="text-3xl font-display font-bold text-foreground">{formatRD(installmentAmount)}</p>
            </div>
          </div>

          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-xl font-bold shadow-[0_0_15px_rgba(225,29,72,0.3)] transition-all flex items-center gap-2 disabled:opacity-50 text-lg"
            >
              {createMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : "Generar Préstamo"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
