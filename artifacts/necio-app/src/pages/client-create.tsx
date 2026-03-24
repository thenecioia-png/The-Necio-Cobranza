import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateClient, getGetClientsQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  phone: z.string().optional(),
  address: z.string().optional(),
  cedula: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ClientCreate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", phone: "", address: "", cedula: "" }
  });

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "Cliente creado exitosamente" });
        setLocation("/clients");
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo crear el cliente" });
      }
    }
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({ data });
  };

  return (
    <div className="p-8 lg:p-12 max-w-3xl mx-auto">
      <div className="mb-8">
        <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-8 shadow-xl"
      >
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/50">
          <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Nuevo Cliente</h1>
            <p className="text-muted-foreground text-sm">Ingrese los datos personales para el registro.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Nombre Completo *</label>
              <input 
                {...register("name")}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="Ej. Juan Pérez"
              />
              {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cédula</label>
              <input 
                {...register("cedula")}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                placeholder="000-0000000-0"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Teléfono</label>
              <input 
                {...register("phone")}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="809-000-0000"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Dirección</label>
              <textarea 
                {...register("address")}
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                placeholder="Sector, Calle, Número..."
              />
            </div>
          </div>

          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-xl font-bold shadow-[0_0_15px_rgba(225,29,72,0.3)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
