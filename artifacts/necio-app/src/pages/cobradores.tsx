import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRD, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Trash2, Loader2, X, User, KeyRound,
  CheckCircle2, Clock, Wallet, TrendingUp, Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientAvatar } from "@/components/client-avatar";

const API = "/api";

interface CobradorStats {
  clientCount: number;
  cuotasHoy: number;
  totalHoy: number;
  cobradoHoy: number;
}

interface Cobrador {
  id: number;
  username: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  stats: CobradorStats;
}

function fetchCobradores(): Promise<Cobrador[]> {
  return fetch(`${API}/cobradores`, { credentials: "include" }).then(r => r.json());
}

function StatBadge({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className={cn("flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2")}>
      <Icon className={cn("w-4 h-4 shrink-0", color)} />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none">{label}</p>
        <p className="text-sm font-bold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

async function uploadAvatar(file: File): Promise<string | null> {
  try {
    const urlRes = await fetch(`${API}/storage/uploads/request-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!urlRes.ok) return null;
    const { uploadURL, objectPath } = await urlRes.json();
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) return null;
    return objectPath as string;
  } catch {
    return null;
  }
}

export default function Cobradores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cobrador | null>(null);
  const [updatingAvatarId, setUpdatingAvatarId] = useState<number | null>(null);

  const { data: cobradores = [], isLoading } = useQuery({
    queryKey: ["cobradores"],
    queryFn: fetchCobradores,
    refetchInterval: 30_000,
  });

  const handleAvatarFileSelected = (file: File) => {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = e => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.username || !form.password) {
      toast({ variant: "destructive", title: "Completa todos los campos" });
      return;
    }
    setCreating(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        const path = await uploadAvatar(avatarFile);
        if (path) avatarUrl = path;
      }

      const res = await fetch(`${API}/cobradores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["cobradores"] });
      toast({ title: "¡Cobrador creado!", description: `${data.name} ya puede iniciar sesión.` });
      setShowCreate(false);
      setForm({ name: "", username: "", password: "" });
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const handleAvatarUpdate = async (cob: Cobrador, file: File) => {
    setUpdatingAvatarId(cob.id);
    try {
      const path = await uploadAvatar(file);
      if (!path) throw new Error("No se pudo subir la foto");
      const res = await fetch(`${API}/cobradores/${cob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarUrl: path }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["cobradores"] });
      toast({ title: "Foto actualizada", description: `La foto de ${cob.name} fue actualizada.` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la foto." });
    } finally {
      setUpdatingAvatarId(null);
    }
  };

  const handleDelete = async (cobrador: Cobrador) => {
    setDeletingId(cobrador.id);
    try {
      const res = await fetch(`${API}/cobradores/${cobrador.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["cobradores"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cobrador eliminado", description: `${cobrador.name} fue removido del sistema.` });
      setConfirmDelete(null);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el cobrador." });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold">Cobradores</h1>
          <p className="text-muted-foreground mt-1">
            {cobradores.length} cobrador(es) activo(s)
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-5 py-3 rounded-xl shadow-[0_0_15px_rgba(225,29,72,0.3)] transition-all"
        >
          <Plus className="w-5 h-5" /> Nuevo Cobrador
        </button>
      </div>

      {/* Cobrador Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-card rounded-3xl animate-pulse" />)}
        </div>
      ) : cobradores.length === 0 ? (
        <div className="text-center py-24 bg-card border border-dashed border-border rounded-3xl">
          <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-display font-bold mb-2">Sin cobradores</h3>
          <p className="text-muted-foreground mb-6">Agrega tu primer cobrador para asignarle clientes.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(225,29,72,0.3)]"
          >
            <Plus className="w-5 h-5" /> Agregar Cobrador
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence>
            {cobradores.map((cob, idx) => {
              const pendiente = cob.stats.totalHoy - cob.stats.cobradoHoy;
              const pct = cob.stats.totalHoy > 0
                ? Math.round((cob.stats.cobradoHoy / cob.stats.totalHoy) * 100)
                : 0;
              const isUpdating = updatingAvatarId === cob.id;

              return (
                <motion.div
                  key={cob.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-card border border-border rounded-3xl p-6 shadow-md hover:border-primary/30 transition-all"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Clickable avatar to change photo */}
                      <label className="relative cursor-pointer group shrink-0">
                        {isUpdating ? (
                          <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            <ClientAvatar name={cob.name} avatarUrl={cob.avatarUrl} size="md" />
                            <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Camera className="w-4 h-4 text-white" />
                            </div>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleAvatarUpdate(cob, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{cob.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">@{cob.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(cob)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                      title="Eliminar cobrador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <StatBadge icon={Users} label="Clientes" value={`${cob.stats.clientCount}`} color="text-blue-400" />
                    <StatBadge icon={Clock} label="Cuotas hoy" value={`${cob.stats.cuotasHoy}`} color="text-amber-400" />
                    <StatBadge icon={Wallet} label="Cobrado hoy" value={formatRD(cob.stats.cobradoHoy)} color="text-emerald-400" />
                    <StatBadge icon={TrendingUp} label="Pendiente hoy" value={formatRD(pendiente)} color="text-primary" />
                  </div>

                  {/* Progress bar */}
                  {cob.stats.cuotasHoy > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Progreso de hoy</span>
                        <span className="font-bold text-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowCreate(false)}
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
                      <Users className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-display font-bold">Nuevo Cobrador</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">Crea la cuenta del cobrador de campo.</p>
                  </div>
                  <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  {/* Avatar upload */}
                  <div className="flex justify-center">
                    <label className="relative cursor-pointer group">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Preview"
                          className="w-20 h-20 rounded-2xl object-cover shadow-lg"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-rose-900 flex flex-col items-center justify-center gap-1 shadow-lg">
                          <Camera className="w-6 h-6 text-white/80" />
                          <span className="text-white/70 text-[10px] font-semibold">Foto</span>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleAvatarFileSelected(file);
                        }}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Nombre completo
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Ej. Carlos Rodríguez"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Usuario (para iniciar sesión)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">@</span>
                      <input
                        type="text"
                        placeholder="carlos"
                        value={form.username}
                        onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))}
                        className="w-full bg-background border border-border rounded-xl pl-8 pr-4 py-3 text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="flex-1 bg-background border border-border rounded-xl py-3 font-semibold text-muted-foreground hover:text-foreground transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl py-3 font-bold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Crear Cobrador
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setConfirmDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4"
            >
              <div className="bg-card border border-destructive/40 rounded-3xl p-7 shadow-2xl">
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-7 h-7 text-destructive" />
                  </div>
                  <h3 className="text-xl font-display font-bold">¿Eliminar cobrador?</h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    <span className="font-bold text-foreground">{confirmDelete.name}</span> será removido y sus clientes
                    quedarán sin asignar.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 bg-background border border-border rounded-xl py-3 font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDelete)}
                    disabled={deletingId === confirmDelete.id}
                    className="flex-1 bg-destructive hover:bg-destructive/90 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {deletingId === confirmDelete.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Eliminar
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
