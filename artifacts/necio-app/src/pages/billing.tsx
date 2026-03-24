import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Zap, Building2, Shield, ArrowRight, Loader2, X, Bell, MessageCircle, Send, Download, Mail, HardDrive, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_BASE = "/api";

type Plan = "basic" | "pro" | "enterprise";

interface Subscription {
  plan: Plan;
  planName: string;
  price: number;
  clientLimit: number | null;
  features: string[];
  subscriptionStatus: string;
  hasActiveSubscription: boolean;
}

interface Plans {
  basic: { name: string; price: number; clientLimit: number | null; features: string[] };
  pro: { name: string; price: number; clientLimit: number | null; features: string[] };
  enterprise: { name: string; price: number; clientLimit: number | null; features: string[] };
}

const PLAN_COLORS: Record<Plan, { bg: string; border: string; badge: string; button: string }> = {
  basic: {
    bg: "bg-card",
    border: "border-border",
    badge: "bg-slate-500/20 text-slate-400",
    button: "bg-slate-700 hover:bg-slate-600 text-white",
  },
  pro: {
    bg: "bg-gradient-to-b from-primary/10 to-card",
    border: "border-primary/50",
    badge: "bg-primary/20 text-primary",
    button: "bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]",
  },
  enterprise: {
    bg: "bg-gradient-to-b from-violet-500/10 to-card",
    border: "border-violet-500/40",
    badge: "bg-violet-500/20 text-violet-400",
    button: "bg-violet-600 hover:bg-violet-500 text-white",
  },
};

const PLAN_ICONS: Record<Plan, React.FC<{ className?: string }>> = {
  basic: Building2,
  pro: Zap,
  enterprise: Shield,
};

interface BackupSettings {
  email: string;
  frequency: string;
  enabled: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpPassSet: boolean;
  lastSentAt: string | null;
}

export default function Billing() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plans | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState<Plan | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<{ configured: boolean; fromNumber: string | null } | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  // Backup state
  const [backup, setBackup] = useState<BackupSettings>({
    email: "", frequency: "weekly", enabled: true,
    smtpUser: "", smtpPass: "", smtpPassSet: false, lastSentAt: null,
  });
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupSending, setBackupSending] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/stripe/subscription`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/stripe/plans`).then(r => r.json()),
      fetch(`${API_BASE}/notifications/whatsapp/status`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/backup/settings`, { credentials: "include" }).then(r => r.json()).catch(() => null),
    ]).then(([sub, pl, ws, bk]) => {
      setSubscription(sub);
      setPlans(pl);
      setWhatsappStatus(ws);
      if (bk) {
        setBackup(prev => ({
          ...prev,
          email: bk.email ?? "",
          frequency: bk.frequency ?? "weekly",
          enabled: bk.enabled ?? true,
          smtpUser: bk.smtpUser ?? "",
          smtpPassSet: bk.smtpPassSet ?? false,
          lastSentAt: bk.lastSentAt ?? null,
        }));
      }
    }).catch(() => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la información de facturación." });
    }).finally(() => setLoading(false));
  }, []);

  const handleSaveBackup = async () => {
    setBackupSaving(true);
    try {
      const res = await fetch(`${API_BASE}/backup/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: backup.email,
          frequency: backup.frequency,
          enabled: backup.enabled,
          smtpUser: backup.smtpUser,
          ...(backup.smtpPass ? { smtpPass: backup.smtpPass } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBackup(prev => ({ ...prev, smtpPass: "", smtpPassSet: !!prev.smtpUser }));
      toast({ title: "Configuración guardada", description: "Los ajustes de respaldo se guardaron correctamente." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setBackupSaving(false);
    }
  };

  const handleSendBackup = async () => {
    setBackupSending(true);
    try {
      const res = await fetch(`${API_BASE}/backup/send`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const now = new Date().toLocaleString("es-DO");
      setBackup(prev => ({ ...prev, lastSentAt: new Date().toISOString() }));
      toast({ title: "Respaldo enviado", description: `El correo fue enviado exitosamente a ${backup.email}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al enviar", description: e.message });
    } finally {
      setBackupSending(false);
    }
  };

  const handleDownload = (type: "clientes" | "prestamos" | "cuotas") => {
    setDownloadOpen(false);
    window.location.href = `${API_BASE}/backup/download?type=${type}`;
  };

  const handleUpgrade = async (plan: Plan) => {
    if (plan === "basic") return;
    setUpgradeLoading(plan);
    try {
      const res = await fetch(`${API_BASE}/stripe/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Stripe no configurado",
        description: e.message || "Conecta tu cuenta de Stripe para activar los pagos.",
      });
    } finally {
      setUpgradeLoading(null);
    }
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stripe/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Suscripción cancelada", description: data.message });
      setShowCancel(false);
      const sub = await fetch(`${API_BASE}/stripe/subscription`, { credentials: "include" }).then(r => r.json());
      setSubscription(sub);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setTestLoading(true);
    try {
      const res = await fetch(`${API_BASE}/notifications/whatsapp/bulk-reminders`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error || data.message);
      toast({
        title: "✅ WhatsApp enviado",
        description: data.total === 0
          ? "No hay cuotas para mañana."
          : `${data.sent} recordatorio(s) enviados de ${data.total} cuotas de mañana.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error WhatsApp", description: e.message });
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || "basic";
  const allPlans: [Plan, keyof Plans][] = [["basic", "basic"], ["pro", "pro"], ["enterprise", "enterprise"]];

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Facturación y Plan</h1>
        <p className="text-muted-foreground mt-1">Gestiona tu suscripción y servicios adicionales.</p>
      </div>

      {/* Current plan banner */}
      {subscription && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border rounded-3xl p-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Plan Actual</p>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-bold">{subscription.planName}</h2>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded uppercase",
                  subscription.hasActiveSubscription
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "bg-slate-500/20 text-slate-400"
                )}>
                  {subscription.hasActiveSubscription ? "✓ Activo" : "Gratuito"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {subscription.clientLimit ? `Hasta ${subscription.clientLimit} clientes` : "Clientes ilimitados"} ·{" "}
                {!subscription.price ? "Gratis" : `$${subscription.price}/mes`}
              </p>
            </div>
          </div>
          {subscription.hasActiveSubscription && (
            <button
              onClick={() => setShowCancel(true)}
              className="text-sm text-muted-foreground hover:text-red-400 transition-colors border border-border px-4 py-2 rounded-xl hover:border-red-500/30"
            >
              Cancelar suscripción
            </button>
          )}
        </motion.div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {allPlans.map(([planKey, planData], idx) => {
          if (!plans) return null;
          const plan = plans[planData];
          const colors = PLAN_COLORS[planKey];
          const Icon = PLAN_ICONS[planKey];
          const isCurrent = currentPlan === planKey;
          const isPopular = planKey === "pro";

          return (
            <motion.div
              key={planKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "relative rounded-3xl border p-6 flex flex-col",
                colors.bg,
                isCurrent ? colors.border : "border-border",
                isCurrent && "ring-1 ring-primary/30"
              )}
            >
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Más Popular
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Plan Actual
                  </span>
                </div>
              )}

              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", colors.badge)}>
                <Icon className="w-5 h-5" />
              </div>

              <h3 className="text-xl font-display font-bold mb-1">{plan.name}</h3>
              <div className="mb-4">
                {plan.price === 0 ? (
                  <span className="text-3xl font-display font-bold">Gratis</span>
                ) : (
                  <>
                    <span className="text-3xl font-display font-bold">${plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mes</span>
                  </>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(planKey)}
                disabled={isCurrent || planKey === "basic" || upgradeLoading === planKey}
                className={cn(
                  "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                  isCurrent || planKey === "basic"
                    ? "bg-secondary text-muted-foreground cursor-default"
                    : colors.button
                )}
              >
                {upgradeLoading === planKey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {isCurrent ? "Plan Actual" : planKey === "basic" ? "Disponible siempre" : `Cambiar a ${plan.name}`}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* WhatsApp Notifications section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card border border-border rounded-3xl p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold">Notificaciones WhatsApp</h2>
            <p className="text-sm text-muted-foreground">Recordatorios y confirmaciones de pago automáticos</p>
          </div>
          <div className="ml-auto">
            <span className={cn(
              "text-xs font-bold px-3 py-1.5 rounded-xl uppercase",
              whatsappStatus?.configured
                ? "bg-emerald-500/20 text-emerald-500"
                : "bg-amber-500/20 text-amber-500"
            )}>
              {whatsappStatus?.configured ? "✓ Conectado" : "No configurado"}
            </span>
          </div>
        </div>

        {whatsappStatus?.configured ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">
                  Twilio activo · Número de salida:{" "}
                  <span className="font-mono text-emerald-400 font-semibold">{whatsappStatus.fromNumber}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Los mensajes se envían como WhatsApp Business vía Twilio.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-background rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recordatorios automáticos</p>
                <p className="text-sm text-muted-foreground mb-3">Envía recordatorio a todos los clientes con cuota para mañana.</p>
                <button
                  onClick={handleTestWhatsApp}
                  disabled={testLoading}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar recordatorios de mañana
                </button>
              </div>

              <div className="bg-background rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Funciones activas</p>
                <div className="space-y-1.5">
                  {["✓ Confirmación automática al cobrar", "✓ Recordatorio día anterior al vencimiento", "✓ Envío masivo manual"].map(f => (
                    <p key={f} className="text-sm text-emerald-400 font-medium">{f}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Twilio aún no está configurado correctamente. Verifica que los siguientes secretos estén activos en el proyecto:
            </p>
            <div className="bg-background rounded-2xl border border-border p-4 space-y-2 font-mono text-xs">
              {["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"].map(k => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-amber-500">⚠</span>
                  <span className="text-muted-foreground">{k}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {["Recordatorios de cuotas próximas", "Confirmaciones de pago al cobrar", "Envío masivo de recordatorios"].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Backup section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-card border border-border rounded-3xl p-6 mb-6"
      >
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-display font-bold">Respaldo de Datos</h2>
            <p className="text-sm text-muted-foreground">Exporta y envía tu cartera por correo electrónico</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <button
                onClick={() => setDownloadOpen(o => !o)}
                className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
              >
                <Download className="w-4 h-4" /> Descargar CSV <ChevronDown className="w-3 h-3" />
              </button>
              {downloadOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setDownloadOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-30 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden min-w-[180px]">
                    {(["clientes", "prestamos", "cuotas"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => handleDownload(t)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 text-foreground transition-colors capitalize"
                      >
                        {t === "prestamos" ? "Préstamos" : t === "cuotas" ? "Cuotas / Pagos" : "Clientes"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Correo de destino
              </label>
              <input
                type="email"
                value={backup.email}
                onChange={e => setBackup(p => ({ ...p, email: e.target.value }))}
                placeholder="tu@gmail.com"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Frecuencia
              </label>
              <select
                value={backup.frequency}
                onChange={e => setBackup(p => ({ ...p, frequency: e.target.value }))}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Gmail (remitente)
              </label>
              <input
                type="email"
                value={backup.smtpUser}
                onChange={e => setBackup(p => ({ ...p, smtpUser: e.target.value }))}
                placeholder="tu@gmail.com"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                App Password de Gmail
                {backup.smtpPassSet && !backup.smtpPass && (
                  <span className="ml-2 text-emerald-400 normal-case font-normal">✓ Guardada</span>
                )}
              </label>
              <input
                type="password"
                value={backup.smtpPass}
                onChange={e => setBackup(p => ({ ...p, smtpPass: e.target.value }))}
                placeholder={backup.smtpPassSet ? "••••••••••••••••" : "xxxx xxxx xxxx xxxx"}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Crea una App Password en <span className="text-blue-400">myaccount.google.com → Seguridad → Contraseñas de aplicaciones</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-border/50">
          <div>
            {backup.lastSentAt && (
              <p className="text-xs text-muted-foreground">
                Último respaldo: <span className="text-foreground font-medium">{new Date(backup.lastSentAt).toLocaleString("es-DO")}</span>
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveBackup}
              disabled={backupSaving || !backup.email}
              className="flex items-center gap-2 bg-background border border-border hover:border-primary/50 text-foreground px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            >
              {backupSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar configuración
            </button>
            <button
              onClick={handleSendBackup}
              disabled={backupSending || !backup.email}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg"
            >
              {backupSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Enviar respaldo ahora
            </button>
          </div>
        </div>
      </motion.div>

      {/* Cancel confirmation modal */}
      {showCancel && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowCancel(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4">
            <div className="bg-card border border-border rounded-3xl p-7 shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-display font-bold">¿Cancelar suscripción?</h3>
                <button onClick={() => setShowCancel(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Tu plan volverá a Basic inmediatamente. Perderás acceso a las funciones Pro/Enterprise.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowCancel(false)} className="flex-1 bg-background border border-border rounded-xl py-3 font-semibold text-sm">
                  Conservar plan
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl py-3 font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Sí, cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
