import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateClient, getGetClientsQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, Loader2, User, Phone, MapPin, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { ClientAvatarUpload } from "@/components/client-avatar";

const API_BASE = "/api";

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apodo: z.string().optional(),
  cedula: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  sector: z.string().optional(),
  ciudad: z.string().optional(),
  notes: z.string().optional(),
  fiadorName: z.string().optional(),
  fiadorPhone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{children}</label>;
}

function FieldInput({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div>
      <input
        {...props}
        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
      />
      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/50">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function ClientCreate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", apodo: "", cedula: "", phone: "", whatsapp: "", address: "", sector: "", ciudad: "", notes: "", fiadorName: "", fiadorPhone: "" }
  });

  const nameValue = watch("name") || "Cliente";

  const handleAvatarSelected = (file: File) => {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = e => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    setAvatarUploading(true);
    try {
      const urlRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) return null;
      const { uploadURL, objectPath } = await urlRes.json();
      const uploadRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) return null;
      return objectPath as string;
    } catch {
      return null;
    } finally {
      setAvatarUploading(false);
    }
  };

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "¡Cliente registrado!", description: `${data.name} fue agregado exitosamente.` });
        setLocation(`/clients/${data.id}`);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo crear el cliente" });
      }
    }
  });

  const onSubmit = async (data: FormValues) => {
    let avatarUrl: string | undefined;
    if (avatarFile) {
      const path = await uploadAvatar(avatarFile);
      if (path) avatarUrl = path;
    }
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ""));
    createMutation.mutate({ data: { ...clean, avatarUrl } as any });
  };

  const isLoading = createMutation.isPending || avatarUploading;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-7 shadow-xl"
      >
        {/* Header with avatar picker */}
        <div className="flex items-center gap-5 mb-8 pb-5 border-b border-border/50">
          <div className="flex flex-col items-center gap-1.5">
            <ClientAvatarUpload
              name={nameValue}
              avatarUrl={null}
              previewUrl={avatarPreview}
              onFileSelected={handleAvatarSelected}
              uploading={avatarUploading}
            />
            <span className="text-[10px] text-muted-foreground">Foto de perfil</span>
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Nuevo Cliente</h1>
            <p className="text-muted-foreground text-sm">Complete la ficha del cliente. Solo el nombre es obligatorio.</p>
            {avatarFile && (
              <p className="text-xs text-emerald-500 mt-1">📸 {avatarFile.name}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* Datos Personales */}
          <section>
            <SectionHeader icon={User} title="Datos Personales" description="Identificación del cliente" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Nombre Completo *</FieldLabel>
                <FieldInput {...register("name")} placeholder="Ej. Juan Antonio Pérez" error={errors.name?.message} />
              </div>
              <div>
                <FieldLabel>Apodo / Como le conocen</FieldLabel>
                <FieldInput {...register("apodo")} placeholder="Ej. El Chino, Negrito..." />
              </div>
              <div>
                <FieldLabel>Cédula</FieldLabel>
                <FieldInput {...register("cedula")} placeholder="000-0000000-0" className="font-mono" />
              </div>
              <div>
                <FieldLabel>Notas internas</FieldLabel>
                <FieldInput {...register("notes")} placeholder="Observaciones, historial..." />
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section>
            <SectionHeader icon={Phone} title="Contacto" description="Teléfonos y comunicación" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Teléfono principal</FieldLabel>
                <FieldInput {...register("phone")} placeholder="809-000-0000" type="tel" />
              </div>
              <div>
                <FieldLabel>WhatsApp</FieldLabel>
                <FieldInput {...register("whatsapp")} placeholder="809-000-0000 (si es diferente)" type="tel" />
              </div>
            </div>
          </section>

          {/* Ubicación */}
          <section>
            <SectionHeader icon={MapPin} title="Ubicación" description="Dirección para la ruta de cobro" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Sector / Barrio</FieldLabel>
                <FieldInput {...register("sector")} placeholder="Ej. Los Jardines, La Zurza..." />
              </div>
              <div>
                <FieldLabel>Ciudad</FieldLabel>
                <FieldInput {...register("ciudad")} placeholder="Ej. Santo Domingo, Santiago..." />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Dirección exacta</FieldLabel>
                <FieldInput {...register("address")} placeholder="Calle, número, referencias para llegar..." />
              </div>
            </div>
          </section>

          {/* Fiador */}
          <section>
            <SectionHeader icon={Shield} title="Fiador / Referencia" description="Persona de contacto en caso de mora" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Nombre del Fiador</FieldLabel>
                <FieldInput {...register("fiadorName")} placeholder="Nombre completo" />
              </div>
              <div>
                <FieldLabel>Teléfono del Fiador</FieldLabel>
                <FieldInput {...register("fiadorPhone")} placeholder="809-000-0000" type="tel" />
              </div>
            </div>
          </section>

          <div className="pt-2 flex justify-end gap-3">
            <Link href="/clients" className="px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground transition-all text-sm font-semibold">
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(225,29,72,0.3)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              {avatarUploading ? "Subiendo foto..." : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
